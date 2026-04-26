#timenote vault 规范

核心设计哲学

- timenote 是给个人使用的笔记应用，基于个人笔记考虑极简主义与性能平衡。
- 兼容文件系统
- 人类可读优先: 满足功能前提下，人类尽量基本可读
- 万物皆 markdown: 不直接处理图片或附件, 所有笔记均为 markdown 格式
- 结构化/白名单准入： 引擎仅识别符合正则规范的文件和路径，其余文件视为透明。

## project/vault 结构

```
/my-vault-root
  ├── .timenote
  │   ├── manifest.json
  │   ├── menu.json
  │   ├── delete-log.json  
  │   ├── sync-ledger.json
  │   ├── /cache # (hold, do NOT implement)
  │   ├── settings.json # optional (hold, do NOT implement)
  ├── 2026-04/
  │   ├── 20260425-121000-1110.md
  │   ├── 20260425-130000-2228.jpg
  │   └── YYYYMMDD-HHmmss-SSSR.ext
  └── 2026-05/
```

### 核心数据 (物理文件即真理 Single Source of Truth)

- `/2026-04/20260425-112010-0457.md` (不可修改)
  - `2026-04` : `^[0-9]{4}-[0-9]{2}$`
  - `20260425-112010-0457.md` : `^[0-9]{8}-[0-9]{6}-[0-9]{4}\.[a-zA-Z0-9]+$`
- `/2026-04/20260425-112010-0457.png` 附件使用统一规范

- /manifest.json

```
{
  "project_id": "Bm1ic75uaq",          // 项目唯一标识，任意 URL-safe 字符串
  "name": "My Notes",
  "version": "1.0.0",              // Timenote 协议版本
  "created_at": "2026-04-25T...",
  "updated_at": "2026-04-25T...",
  "config": { // optional (do not implement)
    "volume_format": "YYYY-MM",    // optional 物理目录约定 (do not implement)
  },
  "extensions": {   // optional (do not implement)
    "enabled_plugins": []          // 预留给未来插件系统
  }
}
```

- /menu.json

```
// 支持 10000 节点
// 支持 1000 层级（取决于 javascript 调用栈)
// 支持 拖拽. 存储用嵌套, 运行时可用扁平结构
{
  "version": 1,
  "items": [
    {
      "title": "🔨 工作项目",
      "type": "note";
      "note_id": "20260425121000-8A2F"
      "children": [
        {
          "type": "note",
          "title": "Timenote 架构图",
          "note_id": "20260425121000-8A2F"
        },
      ]
    },
    {
      "title": "💡 近期想法",
      "type": "search",
      "search": "xxx"
    }
  ]
}
```

- /delete-log.json

```
{
  "version": 1,
  "records": {
    "20260425-112010-1234": "2026-04-26T10:00:00Z",
    "20260420-080000-5678": "2026-04-26T11:30:00Z"
  }
}
```

### 非核心数据

- /sync-ledger.json 用于多端 sync 笔记
  - 估算: 100k note, 150B per note, 15M. gzip 压缩后 1.5M. 本地写入几十ms, 解析几十 ms
  - 1天写100条笔记，能支撑30年。
  - 不是核心数据，**可通过核心数据重建**

```
{
  "version": 1,
  "last_sync_time": "2026-04-25T13:00:00Z",
  "entities": {
    // 正常存活的文件（只有最基础的同步与防冲突字段）
    "20260425-112010-1234": {
      "h": "e10adc3949ba59abbe56e057f20f883e", // 内容 Hash (用于判断内容是否改变)
      "u": "2026-04-25T12:10:00Z" // 修改时间 (用于冲突仲裁，本地优先还是云端优先)
    },
    
    // 墓碑节点, 从 delete-log.json 生成
    // 30天过期自动删除, 不紧急(do NOT implement)
    "20260425-112010-1234": {
      "d": true, // deleted: true 标记为墓碑
      "u": "2026-04-25T14:30:00Z" // 删除动作发生的时间
    }
  }
  // 系统管理层：.timenote 下的配置文件
  "meta_files": {
    "manifest.json": { "h": "hash_1...", "u": "2026-04-20T...Z" },
    "menu.json": { "h": "hash_2...", "u": "2026-04-26T...Z" },
  }
}
```

---

### 笔记文件 .md

内在元数据 YAML

```
---

created_at: "2026-04-25T13:00:00Z" // required ISO 8601
updated_at: "2026-04-25T12:10:00Z" // required ISO 8601
_sync_u: "2026-04-25T12:10:00Z" // optional 覆盖 updatedAt
tags: tag1 | [tag1, tag2] // optional
title/titles: title1 | [title1, title2] // optional
aliases/alias: title1 | [title1, title2] # 和 title 一样. 为了兼容 Obsidian
type/types: todo // optional, 默认为 markdown
deleted: true // optional
[custom keys]: xxx

# obsidian 保留字段 do NOT implement
#  cover 可选封面
#  cssclasses 自定义样式
#  public
---
正文
```

##### **indexedDB**

- 用于索引，不需要同步
- 兼容改动时不需要重建
- 如果需要不兼容改动时可直接重建

```
// IndexedDB Object Store: "entities"
{
  // 主键 (Primary Key)
  "id": "20260425-121000-1110",
  "title": ["深入理解 Local-First 架构"], // 优先取 YAML title / alias
  "type": ["markdown"], // 用于前端 Router 决定渲染组件
  "tags": ["架构", "Web"], // 标签数组
  "aliases": ["本地优先"], // 双链解析别名
  "created_at": 1714047000000, // 用于 Timeline 排序 (数值型，查询最快)
  "updated_at": 1714056000000,          
}
```