'use client';

import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, Extension, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Markdown } from 'tiptap-markdown';
import { createTagSuggestion } from '~/components/editor/suggestion';

const SubmitHandler = Extension.create({
  name: 'submitHandler',
  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => {
        this.options.onSubmit?.();
        return true;
      },
    };
  },
});

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  return (
    <div className="border border-muted/30 rounded-t-lg p-1 bg-muted/20 flex flex-wrap gap-0.5">
      <div className="flex gap-0.5 p-1 border-r border-muted/30">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            editor.isActive('bold')
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-xs italic transition-colors ${
            editor.isActive('italic')
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          I
        </button>
      </div>

      <div className="flex gap-0.5 p-1 border-r border-muted/30">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          H2
        </button>
      </div>

      <div className="flex gap-0.5 p-1 border-r border-muted/30">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            editor.isActive('bulletList')
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            editor.isActive('taskList')
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          ☑ Todo
        </button>
      </div>

      <div className="flex gap-0.5 p-1">
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          className="px-2 py-1 rounded text-xs hover:bg-muted text-muted-foreground"
        >
          Table
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${
            editor.isActive('codeBlock')
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground'
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
  placeholder?: string;
  showToolbar?: boolean;
  autoFocus?: boolean;
  minHeight?: string;
  editable?: boolean;
}

const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  (
    {
      initialValue = '',
      onChange,
      onSubmit,
      onBlur,
      availableTags = [],
      className = '',
      placeholder = '',
      showToolbar = true,
      autoFocus = false,
      minHeight = 'auto',
      editable = true,
    },
    ref,
  ) => {
    // 使用 Ref 追踪最新的标签列表和回调，避免 useEditor 闭包捕获旧值
    const tagsRef = useRef(availableTags);
    const callbacksRef = useRef({ onChange, onSubmit, onBlur });

    useEffect(() => {
      tagsRef.current = availableTags;
    }, [availableTags]);

    useEffect(() => {
      callbacksRef.current = { onChange, onSubmit, onBlur };
    }, [onChange, onSubmit, onBlur]);

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
        TaskItem.configure({ nested: true }),
        HorizontalRule,
        SubmitHandler.configure({
          onSubmit: () => callbacksRef.current.onSubmit?.(),
        }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass: 'is-editor-empty',
        }),
        Mention.configure({
          HTMLAttributes: {
            class:
              'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold px-1 rounded',
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
        callbacksRef.current.onChange?.(markdown);
      },
      onBlur: ({ editor }) => {
        const markdown = (editor.storage as any).markdown.getMarkdown();
        callbacksRef.current.onBlur?.(markdown);
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

    // Update editor content when initialValue changes from outside
    useEffect(() => {
      if (
        editor &&
        initialValue !== undefined &&
        initialValue !== (editor.storage as any).markdown.getMarkdown()
      ) {
        // Only update if not focused to avoid flickering while typing
        if (!editor.isFocused) {
          editor.commands.setContent(initialValue, { emitUpdate: false });
        }
      }
    }, [initialValue, editor]);

    if (!editor) return null;

    const hasBgClass = className.includes('bg-');

    return (
      <div className="flex flex-col w-full">
        {editable && showToolbar && <MenuBar editor={editor} />}
        <div
          className={`${editable ? 'border border-t-0 border-muted/30 rounded-b-lg' : ''} ${editable && !hasBgClass ? 'bg-muted/20' : ''} ${editable && !showToolbar ? 'border-t rounded-t-lg' : ''}`}
        >
          <EditorContent editor={editor} />
        </div>

        <style
          dangerouslySetInnerHTML={{
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
            .ProseMirror p.is-editor-empty:first-child::before {
              content: attr(data-placeholder);
              float: left;
              color: #adb5bd;
              pointer-events: none;
              height: 0;
            }
          `,
          }}
        />
      </div>
    );
  },
);

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
