# 索引与搜索设计

> 主文档: [design.md](./design.md)

## 1. 设计原则

- IndexedDB **不存储核心数据**，仅作为排序和标签过滤的结构化索引
- 全文搜索由**内存全文缓存 + 原生字符串匹配**承担 (零依赖)
- 同一时间只索引**当前激活的 vault**，切换 vault 时清空并重建
- 所有索引可从 OPFS 完全重建，不参与同步
- 预留搜索抽象层，未来可按需替换为倒排索引引擎 (如 MiniSearch)

---

## 2. 方案选型

### 2.1 为什么选择内存缓存 + `String.includes()`

| 方案 | 搜索 10K 笔记 | 内存 10K 笔记 | 依赖 | 中文支持 |
|---|---|---|---|---|
| **内存缓存 + includes()** | ~10-30ms | ~10-20MB | 零 | 原生 |
| MiniSearch (倒排索引) | <10ms | ~20-30MB | 6KB gzip | 需自定义 tokenizer |
| 扫描 OPFS 文件 | ~10-20s | ~0 | 零 | 原生 |

**选择理由**:
- 个人笔记通常 <10K 篇，平均 2-5KB/篇，内存 ~20MB 完全可承受
- `String.includes()` 搜索 10K 笔记 ~10-30ms，用户无感知
- 零依赖，实现简单，中文搜索零成本
- MiniSearch 的优势 (模糊匹配、TF-IDF 排序、前缀搜索) 在个人笔记场景感知不强，且增加 tokenizer 复杂度
- 通过搜索抽象层预留升级空间

### 2.2 性能估算

**内存缓存方案** (平均笔记 2KB):

| 规模 | 加载耗时 | 搜索耗时 | 内存占用 |
|---|---|---|---|
| 1000 笔记 | ~0.5-1s | ~1-5ms | ~2 MB |
| 10000 笔记 | ~3-5s | ~10-30ms | ~20 MB |
| 50000 笔记 | ~15-25s | ~50-150ms | ~100 MB |

> 若未来笔记量或单篇大小增长导致性能不足，可通过搜索抽象层无缝切换为 MiniSearch。

---

## 3. IndexedDB 设计

### 3.1 单 vault 约定

同一时间只有当前激活 vault 的数据在 IndexedDB 中。切换 vault 时:

```
1. 清空 Object Store + 内存缓存
2. 遍历 OPFS vault 目录
3. 解析每个 .md 文件的 frontmatter
4. 写入 IndexedDB + 内存缓存
```

**好处**:
- 无需 `project_id` 字段，schema 更简单
- 查询无需带 vault 过滤条件
- 索引体积小，性能好

### 3.2 Object Store: `notes`

```typescript
interface NoteIndex {
  id: string;                              // "20260425-121000-1234"
  title: string;                           // 从 YAML title 提取 (取数组第一项)
  tags: string[];                          // 从 YAML tags 提取
  created_at: number;                      // 时间戳 (数值型，排序用)
  updated_at: number;                      // 时间戳 (数值型，排序用)
}
```

**索引**:

| 名称 | 字段 | 类型 | 用途 |
|---|---|---|---|
| `by_updated` | `updated_at` | 非 unique | 按更新时间排序的 timeline |
| `by_created` | `created_at` | 非 unique | 按创建时间排序 |
| `by_title` | `title` | 非 unique | 按标题排序 |
| `by_tags` | `tags` | 多值 | 按标签过滤 |

### 3.3 IndexService

```typescript
interface IndexService {
  // 单条操作
  indexNote(noteId: string, content: string): Promise<void>;
  removeNoteIndex(noteId: string): Promise<void>;

  // 批量操作
  rebuildIndex(projectId: string): Promise<void>;    // 从 OPFS 重建 (清空后全量写入)
  clearIndex(): Promise<void>;

  // 查询
  getTimeline(limit?: number, offset?: number): Promise<NoteIndex[]>;
  getNotesByTag(tag: string): Promise<NoteIndex[]>;
  getAllTags(): Promise<string[]>;
}
```

---

## 4. 全文搜索: 内存缓存方案

### 4.1 全文缓存

打开 vault 时，将所有笔记正文加载到内存：

```typescript
const contentCache = new Map<string, string>();  // noteId → 去除 frontmatter 后的正文
```

**加载时机**: 与 IndexedDB `rebuildIndex` 同步进行，遍历 OPFS 时一并填充。

### 4.2 搜索抽象层

```typescript
interface SearchProvider {
  add(id: string, content: string): void;
  update(id: string, content: string): void;
  remove(id: string): void;
  search(terms: string[]): SearchResult[];
}

type SearchResult = {
  id: string;
  score: number;
};
```

初期实现为 `SimpleSearchProvider` (includes)，未来可替换为 `MiniSearchProvider` 而不影响上层代码。

### 4.3 SimpleSearchProvider 实现

```typescript
class SimpleSearchProvider implements SearchProvider {
  private cache = new Map<string, string>();

  add(id: string, content: string): void {
    this.cache.set(id, content.toLowerCase());
  }

  update(id: string, content: string): void {
    this.cache.set(id, content.toLowerCase());
  }

  remove(id: string): void {
    this.cache.delete(id);
  }

  search(terms: string[]): SearchResult[] {
    const normalizedTerms = terms.map(t => t.toLowerCase());
    const results: SearchResult[] = [];

    for (const [id, content] of this.cache) {
      let score = 0;
      let allMatch = true;

      for (const term of normalizedTerms) {
        if (content.includes(term)) {
          score += content.split(term).length - 1;  // 出现次数作为相关性
        } else {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        results.push({ id, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}
```

**特点**:
- 所有搜索条件为 AND 关系 (所有 term 必须匹配)
- `score` 基于关键词出现次数，近似相关性
- 大小写不敏感

### 4.4 索引生命周期

```
打开 Vault
  │
  ├── 1. 清空 IndexedDB + contentCache
  ├── 2. 遍历 OPFS vault 所有 .md 文件
  ├── 3. 逐文件: parseNote()
  │        → 写 IndexedDB (NoteIndex)
  │        → contentCache.set(noteId, body)
  │
  ▼
运行中
  │
  ├── 创建笔记: 写 OPFS → 写 IndexedDB → contentCache.set()
  ├── 更新笔记: 写 OPFS → 更新 IndexedDB → contentCache.set()
  ├── 删除笔记: 删 OPFS → 删 IndexedDB → contentCache.delete()
  │
  ▼
离开 Vault
  │
  └── contentCache 释放 (置空 Map, GC 回收)
```

### 4.5 SearchService

```typescript
interface SearchService {
  search(query: string, options?: SearchOptions): Promise<NoteIndex[]>;
}

interface SearchOptions {
  limit?: number;
}
```

### 4.6 搜索流程

```
用户输入: "#架构 local-first"
  │
  ├── parseQuery()
  │     → { tags: ["架构"], textTerms: ["local-first"] }
  │
  ├── tags 非空?
  │     YES → IndexedDB 'by_tags' index → 得到候选集 IDs
  │     NO  → 候选集 = null (不限制)
  │
  ├── textTerms 非空?
  │     YES → searchProvider.search(["local-first"])
  │           → 得到 [{ id, score }] 结果集
  │     NO  → 跳过
  │
  └── 组合结果
        → 两个条件都有: 取 IDs 交集
        → 仅标签: 候选集本身
        → 仅全文: 搜索结果
        → 排序: 有 score 时按 score 降序，否则按 updated_at 降序
        → 从 IndexedDB 补全 title/tags 等展示字段
```

### 4.7 不再需要 content_preview

**结论**: 去掉 `content_preview` 字段。

**原因**:
1. 全文搜索直接在内存 `contentCache` 中匹配完整正文，不需要截断的 preview
2. Timeline 列表中的笔记预览，按需从 OPFS 读取正文前 N 行即可 (单文件读取 ~1ms)
3. 减少 IndexedDB 存储体积，简化 schema

**Timeline 预览方案**: 列表渲染时异步从 OPFS 读取对应 .md 文件，截取 frontmatter 之后前 200 字符。配合虚拟滚动可平滑展示。
