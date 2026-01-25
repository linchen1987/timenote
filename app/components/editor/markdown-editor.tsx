"use client";

import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Mention from "@tiptap/extension-mention";
import { useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import { createTagSuggestion } from "./suggestion";

const SubmitHandler = Extension.create({
  name: 'submitHandler',
  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => {
        this.options.onSubmit?.();
        return true;
      },
    }
  },
});

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-t-lg p-1 bg-gray-50 dark:bg-gray-800 flex flex-wrap gap-0.5">
      <div className="flex gap-0.5 p-1 border-r border-gray-200 dark:border-gray-600">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            editor.isActive("bold") ? "bg-blue-600 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}
        >
          B
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-xs italic transition-colors ${
            editor.isActive("italic") ? "bg-blue-600 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}
        >
          I
        </button>
      </div>

      <div className="flex gap-0.5 p-1 border-r border-gray-200 dark:border-gray-600">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            editor.isActive("heading", { level: 1 }) ? "bg-blue-600 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            editor.isActive("heading", { level: 2 }) ? "bg-blue-600 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}
        >
          H2
        </button>
      </div>

      <div className="flex gap-0.5 p-1 border-r border-gray-200 dark:border-gray-600">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            editor.isActive("bulletList") ? "bg-blue-600 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}
        >
          • List
        </button>
        <button
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            editor.isActive("taskList") ? "bg-blue-600 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}
        >
          ☑ Todo
        </button>
      </div>

      <div className="flex gap-0.5 p-1">
        <button
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className="px-2 py-1 rounded text-xs hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        >
          Table
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            editor.isActive("codeBlock") ? "bg-blue-600 text-white" : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          }`}
        >
          Code
        </button>
      </div>
    </div>
  );
};

export interface MarkdownEditorRef {
  getMarkdown: () => string;
  setMarkdown: (content: string) => void;
  focus: () => void;
}

interface MarkdownEditorProps {
  initialValue?: string;
  onChange?: (markdown: string) => void;
  onSubmit?: () => void;
  onBlur?: (markdown: string) => void;
  availableTags?: string[];
  className?: string;
  showToolbar?: boolean;
  autoFocus?: boolean;
  minHeight?: string;
  editable?: boolean;
}

const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  ({ initialValue = "", onChange, onSubmit, onBlur, availableTags = [], className = "", showToolbar = true, autoFocus = false, minHeight = "auto", editable = true }, ref) => {
    // 使用 Ref 追踪最新的标签列表，避免 useEditor 闭包捕获旧值
    const tagsRef = useRef(availableTags);
    useEffect(() => {
      tagsRef.current = availableTags;
    }, [availableTags]);

    const editor = useEditor({
      extensions: [
        StarterKit,
        Markdown.configure({
          html: true,
          tightLists: true,
          tightListClass: "tight",
          bulletListMarker: "-",
          linkify: false,
          breaks: false,
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        TaskList,
        TaskItem.configure({ nested: true }),
        HorizontalRule,
        SubmitHandler.configure({ onSubmit }),
        Mention.configure({
          HTMLAttributes: {
            class: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold px-1 rounded',
          },
          suggestion: createTagSuggestion(() => tagsRef.current),
        }),
      ],
      content: initialValue,
      editable,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none ${editable ? 'p-4' : 'p-0'} ${className}`,
          style: `min-height: ${minHeight}`,
        },
      },
      onUpdate: ({ editor }) => {
        const markdown = (editor.storage as any).markdown.getMarkdown();
        onChange?.(markdown);
      },
      onBlur: ({ editor }) => {
        const markdown = (editor.storage as any).markdown.getMarkdown();
        onBlur?.(markdown);
      },
    });

    useImperativeHandle(ref, () => ({
      getMarkdown: () => (editor?.storage as any).markdown.getMarkdown(),
      setMarkdown: (content: string) => editor?.commands.setContent(content),
      focus: () => editor?.commands.focus(),
    }));

    useEffect(() => {
      if (editor && autoFocus && editable) {
        editor.commands.focus();
      }
    }, [editor, autoFocus, editable]);

    useEffect(() => {
      if (editor) {
        editor.setEditable(editable);
      }
    }, [editor, editable]);

    if (!editor) return null;

    return (
      <div className="flex flex-col w-full">
        {editable && showToolbar && <MenuBar editor={editor} />}
        <div className={`${editable ? 'border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg bg-white dark:bg-gray-800' : ''} ${editable && !showToolbar ? 'border-t rounded-t-lg' : ''}`}>
          <EditorContent editor={editor} />
        </div>
        
        <style dangerouslySetInnerHTML={{
          __html: `
            .ProseMirror { outline: none; line-height: 1.6; }
            .ProseMirror h1 { font-size: 1.8rem; font-weight: 800; margin-top: 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.2rem; }
            .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; margin-top: 0.8rem; margin-bottom: 0.4rem; }
            .ProseMirror h3 { font-size: 1.2rem; font-weight: 600; margin-top: 0.6rem; margin-bottom: 0.3rem; }
            .ProseMirror p { margin-top: 0.3rem; margin-bottom: 0.3rem; }
            .ProseMirror ul[data-type="taskList"] { list-style: none; padding: 0; margin: 0.5rem 0; }
            .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.2rem; }
            .ProseMirror ul[data-type="taskList"] li > label { margin-top: 0.3rem; flex: 0 0 auto; }
            .ProseMirror ul[data-type="taskList"] li > div { flex: 1 1 auto; }
            .ProseMirror ul[data-type="taskList"] input[type="checkbox"] { cursor: pointer; accent-color: #3b82f6; }
            .ProseMirror table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; font-size: 0.9rem; border: 1px solid #e5e7eb; }
            .ProseMirror table th, .ProseMirror table td { border: 1px solid #e5e7eb; padding: 0.3rem 0.5rem; }
            .ProseMirror table th { background-color: #f8fafc; font-weight: 600; }
            .dark .ProseMirror table, .dark .ProseMirror table th, .dark .ProseMirror table td { border-color: #334155; }
            .dark .ProseMirror table th { background-color: #1e293b; }
            .ProseMirror pre { background: #0f172a; color: #e2e8f0; padding: 0.75rem; border-radius: 6px; margin: 0.5rem 0; }
            .ProseMirror code { background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.9em; }
            .dark .ProseMirror code { background: #334155; }
            .ProseMirror blockquote { border-left: 3px solid #e2e8f0; padding-left: 0.8rem; margin: 0.5rem 0; color: #64748b; }
          `
        }} />
      </div>
    );
  }
);

MarkdownEditor.displayName = "MarkdownEditor";

export default MarkdownEditor;
