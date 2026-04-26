# 同步方案设计

> 主文档: [design.md](./design.md)

## 1. 远程存储结构

```
WebDAV/S3 Root/
  └── timenote/
      └── vaults/
          └── {project_id}/
              ├── .timenote/
              │   ├── manifest.json
              │   ├── menu.json
              │   ├── delete-log.json
              │   └── sync-ledger.json
              ├── 2026-04/
              │   ├── 20260425-121000-1110.md
              │   └── ...
              └── ...
```

**与本地 OPFS 完全一致**，同步就是双向的文件同步。

---

## 2. 同步策略: 三阶段增量同步

### 阶段 1: Ledger 比对

```
Local Ledger                        Remote Ledger
─────────────                       ─────────────
A: h=abc, u=T1                      A: h=abc, u=T1     → 相同，跳过
B: h=def, u=T2                      B: h=xyz, u=T3     → 冲突 (hash 不同)
C: h=ghi, u=T4                      (不存在)           → 本地新增，需推送
(不存在)                             D: h=jkl, u=T5     → 远程新增，需拉取
E: d=true, u=T6                     (不存在)           → 本地已删除，推送删除
(不存在)                             F: d=true, u=T7    → 远程已删除，本地删除
```

**冲突检测规则**:
- 两端 `h` 相同 → 未变更，跳过
- 仅本地存在 → 本地新增，需推送
- 仅远程存在 → 远程新增，需拉取
- 两端都有且 `h` 不同 → 冲突，需解决

### 阶段 2: 双向文件传输

```
拉取 (Remote → Local):
  1. 远程新增的文件 → 下载到 OPFS → 更新索引
  2. 冲突文件 (远程 u > 本地 u) → 下载到 OPFS → 更新索引

推送 (Local → Remote):
  1. 本地新增的文件 → 上传到远程
  2. 冲突文件 (本地 u > 远程 u) → 上传到远程
  3. 本地已删除的文件 (d=true) → 在远程删除 → 更新远程 delete-log

meta 文件 (manifest.json, menu.json 等):
  - 同步逻辑与笔记相同，通过 meta_files 字段比对
```

### 阶段 3: Ledger 合并

```
1. 合并本地和远程 ledger
2. 对冲突项取较新时间戳方的 hash
3. 写入合并后的 ledger 到两端
4. 更新 last_sync_time
```

---

## 3. 冲突解决策略

**默认策略: 最新时间戳优先 (Last-Write-Wins)**

- 比较 `u` (updated_at) 时间戳
- 保留时间戳更新的一方
- **不创建冲突副本** (v0.2.0 简化方案)

---

## 4. 同步触发

- **手动同步**: 用户点击同步按钮
- **自动同步**: 打开 vault 时 pull，离开时 push
- **定时同步** (Extension): Chrome Alarms 每 30 分钟 (延后实现)

---

## 5. SyncResult

```typescript
interface SyncResult {
  pulled: number;       // 拉取文件数
  pushed: number;       // 推送文件数
  conflicts: number;    // 冲突数 (已自动解决)
  errors: string[];     // 错误信息
}

interface SyncStatus {
  lastSyncTime: string | null;
  isSyncing: boolean;
}
```

---

## 6. Hash 计算

使用 **MD5** (快速，用于变更检测，非安全用途)。

使用 `spark-md5` 库 (轻量，纯 JS，支持增量计算):

```typescript
import SparkMD5 from 'spark-md5';

function computeContentHash(content: string): string {
  return SparkMD5.hash(content);
}
```

---

## 7. 同步伪代码

```typescript
async function sync(projectId: string): Promise<SyncResult> {
  const result = { pulled: 0, pushed: 0, conflicts: 0, errors: [] };

  // 1. 读取两端 ledger
  const localLedger = await readLocalLedger(projectId);
  const remoteLedger = await readRemoteLedger(projectId);

  // 2. 读取两端 delete-log
  const localDeleteLog = await readLocalDeleteLog(projectId);
  const remoteDeleteLog = await readRemoteDeleteLog(projectId);

  // 3. 合并 delete-log 到 ledger (墓碑)
  const localEntities = mergeDeleteLog(localLedger.entities, localDeleteLog);
  const remoteEntities = mergeDeleteLog(remoteLedger.entities, remoteDeleteLog);

  // 4. 比对
  const allKeys = new Set([...Object.keys(localEntities), ...Object.keys(remoteEntities)]);

  const toPull: string[] = [];
  const toPush: string[] = [];
  const toDeleteRemote: string[] = [];
  const toDeleteLocal: string[] = [];

  for (const key of allKeys) {
    const local = localEntities[key];
    const remote = remoteEntities[key];

    if (!remote) {
      // 仅本地存在
      if (local.d) toDeleteRemote.push(key);  // 本地已删除，同步删除到远程
      else toPush.push(key);                   // 本地新增
    } else if (!local) {
      // 仅远程存在
      if (remote.d) toDeleteLocal.push(key);   // 远程已删除
      else toPull.push(key);                   // 远程新增
    } else if (local.h !== remote.h) {
      // 两端都有但 hash 不同 → 冲突
      result.conflicts++;
      if (local.u > remote.u) toPush.push(key);   // 本地更新
      else toPull.push(key);                       // 远程更新
    }
    // else: hash 相同，跳过
  }

  // 5. 执行传输
  for (const key of toPull) {
    try {
      const content = await remoteTransport.read(pathForKey(projectId, key));
      await localTransport.write(pathForKey(projectId, key), content);
      await indexNote(key, content);
      result.pulled++;
    } catch (e) {
      result.errors.push(`Pull ${key}: ${e.message}`);
    }
  }

  for (const key of toPush) {
    try {
      const content = await localTransport.read(pathForKey(projectId, key));
      await remoteTransport.write(pathForKey(projectId, key), content);
      result.pushed++;
    } catch (e) {
      result.errors.push(`Push ${key}: ${e.message}`);
    }
  }

  // 6. 同步 meta 文件 (manifest.json, menu.json)
  //    逻辑同上，使用 ledger.meta_files 比对

  // 7. 合并并写入 ledger
  const mergedLedger = buildMergedLedger(localEntities, remoteEntities, toPull, toPush);
  mergedLedger.last_sync_time = new Date().toISOString();
  await writeLocalLedger(projectId, mergedLedger);
  await writeRemoteLedger(projectId, mergedLedger);

  return result;
}
```

---

## 8. 首次同步 (新设备)

当本地 OPFS 为空但远程有数据时:

1. 下载远程 `manifest.json` → 确认 vault 身份
2. 下载远程 `sync-ledger.json`
3. 逐文件下载所有笔记到 OPFS
4. 重建本地索引
5. 写入本地 ledger

**与常规 pull 的区别**: 无本地 ledger 需要比对，全量下载。

---

## 9. 性能考量

- 每次同步先传输 `sync-ledger.json` (小文件)，仅在需要时传输实际笔记文件
- 单文件传输，无需打包/解包，内存占用低
- 大型 vault (10000 笔记) 的 ledger 约 1.5MB (gzip)，传输约 1-2 秒
- 并发传输可加速，但需注意 WebDAV/S3 的并发限制 (建议 3-5 并发)
