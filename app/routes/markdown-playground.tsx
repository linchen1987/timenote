"use client";

import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { Markdown } from "tiptap-markdown";

const defaultMarkdown = `# Markdown Playground

欢迎来到 Markdown 编辑器！这是一个功能丰富的所见即所得编辑器。

## 功能特性

- ✨ **所见即所得** - 实时编辑和渲染
- 🎨 **语法支持** - 支持 GitHub Flavored Markdown
- 📱 **响应式设计** - 适配各种屏幕
- 📋 **一键复制** - 快速复制 markdown 源码

## 语法演示

### 文本格式

**粗体文本** 和 *斜体文本* 以及 ~~删除线~~

### 列表

1. 有序列表项 1
2. 有序列表项 2
   - 嵌套无序列表
   - 另一个嵌套项

### 代码

行内代码 \`const name = "React"\`

代码块：
\`\`\`javascript
function hello(name) {
  console.log(\`Hello, \${name}!\`);
}

hello("Markdown");
\`\`\`

### 表格

| 功能 | 状态 | 描述 |
|------|------|------|
| 编辑 | ✅ | 支持实时编辑 |
| 预览 | ✅ | 实时预览效果 |
| 复制 | ✅ | 一键复制内容 |

### 链接和图片

[访问 React Router 文档](https://reactrouter.com)

### 引用

> 这是一个引用示例。
> 可以包含多行内容。

### 分隔线

---

### 任务列表

- [x] 完成基础编辑功能
- [x] 添加实时预览
- [ ] 添加更多主题
- [ ] 支持插件扩展

## 开始使用

在编辑器中直接编辑内容，实时查看渲染效果。点击复制按钮可以快速复制 Markdown 源码。`;

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-t-lg p-2 bg-gray-50 dark:bg-gray-800 flex flex-wrap gap-1">
      <div className="flex gap-1 p-1 border-r border-gray-200 dark:border-gray-600">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('bold')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="粗体 (Ctrl+B)"
        >
          B
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('italic')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="斜体 (Ctrl+I)"
        >
          I
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('strike')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="删除线"
        >
          S
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('code')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="行内代码"
        >
          {'</>'}
        </button>
      </div>

      <div className="flex gap-1 p-1 border-r border-gray-200 dark:border-gray-600">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="标题 1"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="标题 2"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('heading', { level: 3 })
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="标题 3"
        >
          H3
        </button>
      </div>

      <div className="flex gap-1 p-1 border-r border-gray-200 dark:border-gray-600">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('bulletList')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="无序列表"
        >
          •
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('orderedList')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="有序列表"
        >
          1.
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('taskList')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="任务列表"
        >
          ☑
        </button>
      </div>

      <div className="flex gap-1 p-1 border-r border-gray-200 dark:border-gray-600">
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('blockquote')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="引用"
        >
          "
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('codeBlock')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="代码块"
        >
          {'{}'}
        </button>
      </div>

      <div className="flex gap-1 p-1 border-r border-gray-200 dark:border-gray-600">
        <button
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            editor.isActive('table')
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
          title="插入表格"
        >
          表格
        </button>
      </div>

      <div className="flex gap-1 p-1">
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="px-3 py-1 rounded text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
          title="分隔线"
        >
          —
        </button>
      </div>

      <div className="flex gap-1 p-1 ml-auto">
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="px-3 py-1 rounded text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="撤销 (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="px-3 py-1 rounded text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="重做 (Ctrl+Y)"
        >
          ↷
        </button>
      </div>
    </div>
  );
};

export default function MarkdownPlayground() {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [isEditorReady, setIsEditorReady] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: true,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: false,
        breaks: false,
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem,
      HorizontalRule,
    ],
    content: defaultMarkdown,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-6',
      },
    },
  });

  const handleCopy = useCallback(() => {
    if (editor) {
      const markdown = (editor.storage as any).markdown.getMarkdown();
      navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [editor]);

  const handleReset = useCallback(() => {
    if (editor) {
      editor.commands.setContent(defaultMarkdown);
    }
  }, [editor]);

  const getMarkdown = useCallback(() => {
    if (editor) {
      return (editor.storage as any).markdown.getMarkdown();
    }
    return '';
  }, [editor]);

  useEffect(() => {
    if (editor) {
      const timer = setTimeout(() => {
        setIsEditorReady(true);
        editor.commands.setContent(defaultMarkdown);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [editor]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <nav className="mb-4">
            <Link
              to="/indexes"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← All Demos
            </Link>
          </nav>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Markdown Playground
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                真正的所见即所得 Markdown 编辑器
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!isEditorReady || !editor}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {copied ? "✓ 已复制" : "📋 复制 Markdown"}
              </button>
              
              <button
                onClick={handleReset}
                disabled={!isEditorReady || !editor}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                🔄 重置
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">视图模式:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode("edit")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === "edit"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              编辑
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === "preview"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              源码预览
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {viewMode === "edit" && isEditorReady && editor && (
            <>
              <MenuBar editor={editor} />
              <EditorContent editor={editor} />
            </>
          )}
          {viewMode === "edit" && !isEditorReady && (
            <div className="flex items-center justify-center h-[500px] text-gray-500 dark:text-gray-400">
              正在加载编辑器...
            </div>
          )}

          {viewMode === "preview" && (
            <div className="p-6 h-[600px] overflow-y-auto">
              <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                <code className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {getMarkdown()}
                </code>
              </pre>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              ✏️ 真正的所见即所得
            </h3>
            <p className="text-blue-700 dark:text-blue-400 text-sm">
              直接编辑渲染后的内容，而不是分开的编辑和预览窗口
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">
              📝 完整 Markdown 支持
            </h3>
            <p className="text-green-700 dark:text-green-400 text-sm">
              支持标题、列表、表格、代码、任务列表等完整语法
            </p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">
              💾 保存为 Markdown
            </h3>
            <p className="text-purple-700 dark:text-purple-400 text-sm">
              编辑器内容自动保存为标准的 Markdown 格式
            </p>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{
          __html: `
            .ProseMirror {
              outline: none;
              padding: 1.25rem 1.5rem;
              line-height: 1.6;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            
            .ProseMirror h1 {
              font-size: 2rem;
              font-weight: 800;
              letter-spacing: -0.025em;
              margin-top: 0.5rem;
              margin-bottom: 0.75rem;
              color: #111827;
              border-bottom: 1px solid #f3f4f6;
              padding-bottom: 0.25rem;
            }
            
            .ProseMirror h2 {
              font-size: 1.5rem;
              font-weight: 700;
              letter-spacing: -0.02em;
              margin-top: 1rem;
              margin-bottom: 0.5rem;
              color: #1f2937;
            }
            
            .ProseMirror h3 {
              font-size: 1.25rem;
              font-weight: 600;
              margin-top: 0.75rem;
              margin-bottom: 0.4rem;
              color: #374151;
            }
            
            .dark .ProseMirror h1 { color: #f9fafb; border-bottom-color: #374151; }
            .dark .ProseMirror h2 { color: #f3f4f6; }
            .dark .ProseMirror h3 { color: #e5e7eb; }
            
            .ProseMirror p {
              margin-top: 0.4rem;
              margin-bottom: 0.4rem;
              color: #374151;
            }
            
            .dark .ProseMirror p {
              color: #d1d5db;
            }
            
            .ProseMirror ul[data-type="taskList"] {
              margin: 0.5rem 0;
              padding: 0;
            }
            
            .ProseMirror ul[data-type="taskList"] li {
              display: flex;
              align-items: flex-start;
              gap: 0.5rem;
              margin-bottom: 0.25rem;
            }
            
            .ProseMirror ul:not([data-type="taskList"]), 
            .ProseMirror ol {
              padding-left: 1.25rem;
              margin: 0.5rem 0;
            }
            
            .ProseMirror li p {
              margin: 0;
            }
            
            .ProseMirror table {
              border-collapse: collapse;
              width: 100%;
              margin: 0.75rem 0;
              font-size: 0.9rem;
              border: 1px solid #e5e7eb;
              border-radius: 4px;
            }
            
            .ProseMirror table th,
            .ProseMirror table td {
              border: 1px solid #e5e7eb;
              padding: 0.4rem 0.6rem;
              min-width: 1em;
            }
            
            .ProseMirror table th {
              background-color: #f8fafc;
              font-weight: 600;
              color: #475569;
            }
            
            .dark .ProseMirror table,
            .dark .ProseMirror table th,
            .dark .ProseMirror table td {
              border-color: #334155;
            }
            
            .ProseMirror pre {
              background: #0f172a;
              color: #e2e8f0;
              padding: 0.75rem 1rem;
              border-radius: 6px;
              margin: 0.75rem 0;
            }
            
            .ProseMirror blockquote {
              border-left: 3px solid #e2e8f0;
              padding-left: 1rem;
              margin: 0.75rem 0;
              color: #64748b;
            }
            
            .ProseMirror hr {
              border: none;
              border-top: 1px solid #f1f5f9;
              margin: 1.25rem 0;
            }
            
            .dark .ProseMirror hr {
              border-top-color: #1e293b;
            }

            .ProseMirror ul[data-type="taskList"] li > label {
              margin-top: 0.3rem;
            }
          `
        }} />
      </div>
    </main>
  );
}
