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
import { type Editor, EditorContent, Extension, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Markdown } from 'tiptap-markdown';
import { createTagSuggestion } from '~/components/editor/suggestion';

function removeTrailingSpaceFromLinks(editor: Editor) {
  const { selection, tr } = editor.state;
  const $head = selection.$head;

  const linkMarkAtCursor = $head.marks().find((m) => m.type.name === 'link');
  if (!linkMarkAtCursor) return;

  const nodeBefore = $head.nodeBefore;
  if (!nodeBefore || !nodeBefore.isText) return;

  const text = nodeBefore.text || '';
  const trailingMatch = text.match(/(\s+)$/);
  if (!trailingMatch) return;

  const pos = $head.pos - text.length;
  const spaceStart = pos + text.length - trailingMatch[1].length;
  const spaceEnd = pos + text.length;

  tr.removeMark(spaceStart, spaceEnd, linkMarkAtCursor);
  editor.view.dispatch(tr);
}

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

interface MarkdownStorage {
  getMarkdown: () => string;
}

const MenuBar = ({
  editor,
  isRawMode,
  onToggleRawMode,
}: {
  editor: Editor;
  isRawMode: boolean;
  onToggleRawMode: () => void;
}) => {
  if (!editor) return null;

  return (
    <div className="border border-muted/30 rounded-t-lg p-1 bg-muted/20 flex flex-wrap gap-0.5">
      <div className="flex gap-0.5 p-1 border-r border-muted/30">
        <button
          type="button"
          onClick={onToggleRawMode}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
            isRawMode
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          &lt;/&gt;
        </button>
      </div>
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
    const [isRawMode, setIsRawMode] = useState(false);
    const [rawContent, setRawContent] = useState(initialValue);

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
      autofocus: autoFocus ? 'end' : false,
      extensions: [
        StarterKit,
        Markdown.configure({
          html: true,
          tightLists: true,
          tightListClass: 'tight',
          bulletListMarker: '-',
          linkify: true,
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
      immediatelyRender: true,
      editorProps: {
        attributes: {
          class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none ${editable ? 'p-4' : 'p-0'} ${className}`,
          style: `min-height: ${minHeight}; ${!editable ? 'user-select: text;' : ''}`,
        },
        handleClickOn: (_view, _pos, node, _nodePos, event, _direct) => {
          if (!editable && node.type.name === 'text') {
            const marks = node.marks;
            const linkMark = marks.find((mark) => mark.type.name === 'link');
            if (linkMark) {
              event.preventDefault();
              window.open(linkMark.attrs.href, '_blank', 'noopener,noreferrer');
              return true;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        removeTrailingSpaceFromLinks(editor);
        const markdown = (
          editor.storage as unknown as Record<string, MarkdownStorage>
        ).markdown.getMarkdown();
        callbacksRef.current.onChange?.(markdown);
      },
      onBlur: ({ editor }) => {
        const markdown = (
          editor.storage as unknown as Record<string, MarkdownStorage>
        ).markdown.getMarkdown();
        callbacksRef.current.onBlur?.(markdown);
      },
    });

    useImperativeHandle(ref, () => ({
      getMarkdown: () =>
        isRawMode
          ? rawContent
          : (
              editor?.storage as unknown as Record<string, MarkdownStorage> | undefined
            )?.markdown.getMarkdown() || '',
      setMarkdown: (content: string) => {
        setRawContent(content);
        editor?.commands.setContent(content);
      },
      focus: () => editor?.commands.focus(),
    }));

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
        initialValue !==
          (editor.storage as unknown as Record<string, MarkdownStorage>).markdown.getMarkdown()
      ) {
        // Only update if not focused to avoid flickering while typing
        if (!editor.isFocused) {
          editor.commands.setContent(initialValue, { emitUpdate: false });
        }
      }
    }, [initialValue, editor]);

    // Update raw content when initialValue changes
    useEffect(() => {
      setRawContent(initialValue);
    }, [initialValue]);

    const toggleRawMode = () => {
      if (isRawMode) {
        // raw to rich: set editor content from raw
        editor?.commands.setContent(rawContent, { emitUpdate: true });
        setIsRawMode(false);
      } else {
        // rich to raw: get markdown from editor
        if (editor) {
          const markdown = (
            editor.storage as unknown as Record<string, MarkdownStorage>
          ).markdown.getMarkdown();
          setRawContent(markdown);
          setIsRawMode(true);
        }
      }
    };

    const handleRawContentChange = (content: string) => {
      setRawContent(content);
      callbacksRef.current.onChange?.(content);
    };

    const handleRawBlur = () => {
      callbacksRef.current.onBlur?.(rawContent);
    };

    const handleRawKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.metaKey && e.key === 'Enter') {
        e.preventDefault();
        callbacksRef.current.onSubmit?.();
      }
    };

    if (!editor && !isRawMode) return null;

    const hasBgClass = className.includes('bg-');

    return (
      <div className="flex flex-col w-full">
        {editable && showToolbar && (
          <MenuBar editor={editor} isRawMode={isRawMode} onToggleRawMode={toggleRawMode} />
        )}
        <div
          className={`${editable ? 'border border-t-0 border-muted/30 rounded-b-lg' : ''} ${editable && !hasBgClass ? 'bg-muted/20' : ''} ${editable && !showToolbar ? 'border-t rounded-t-lg' : ''}`}
        >
          {isRawMode ? (
            <textarea
              value={rawContent}
              onChange={(e) => editable && handleRawContentChange(e.target.value)}
              onBlur={handleRawBlur}
              onKeyDown={handleRawKeyDown}
              placeholder={placeholder}
              disabled={!editable}
              className={`w-full p-4 font-mono text-sm resize-none focus:outline-none ${className}`}
              style={{ minHeight, userSelect: editable ? 'auto' : 'text' }}
            />
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>

        <style
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Intentional styles
          dangerouslySetInnerHTML={{
            __html: `
            .ProseMirror { outline: none; line-height: 1.6; }
            .ProseMirror h1 { font-size: 1.8rem; font-weight: 800; margin-top: 0.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.2rem; }
            .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; margin-top: 0.8rem; margin-bottom: 0.4rem; }
            .ProseMirror h3 { font-size: 1.2rem; font-weight: 600; margin-top: 0.6rem; margin-bottom: 0.3rem; }
            .ProseMirror p { margin-top: 0.3rem; margin-bottom: 0.3rem; }
            .ProseMirror ul { padding-left: 1.5rem; margin: 0.5rem 0; list-style-type: disc; }
            .ProseMirror ul ul { list-style-type: circle; }
            .ProseMirror ul ul ul { list-style-type: square; }
            .ProseMirror ol { padding-left: 1.5rem; margin: 0.5rem 0; list-style-type: decimal; }
            .ProseMirror ol ol { list-style-type: lower-alpha; }
            .ProseMirror ol ol ol { list-style-type: lower-roman; }
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
            .ProseMirror hr { border: none; border-top: 1px solid #e5e7eb; margin: 0.75rem 0; }
            .dark .ProseMirror hr { border-color: #334155; }
            .ProseMirror p.is-editor-empty:first-child::before {
              content: attr(data-placeholder);
              float: left;
              color: #adb5bd;
              pointer-events: none;
              height: 0;
            }
            .ProseMirror[contenteditable="false"] {
              user-select: text;
              -webkit-user-select: text;
            }
            .ProseMirror a {
              color: #3b82f6;
              text-decoration: underline;
              cursor: pointer;
            }
            .ProseMirror a:hover {
              color: #2563eb;
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
