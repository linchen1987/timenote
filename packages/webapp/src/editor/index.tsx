import { useRef, ComponentProps, MutableRefObject } from 'react';

import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';

import type { LexicalEditor, EditorState } from 'lexical';
import { TRANSFORMERS, CHECK_LIST } from '@lexical/markdown';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';

import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';

import DeleteLinePlugin from './plugins/DeleteLinePlugin';
import AutoLinkPlugin from './plugins/AutoLinkPlugin';
import KeyboardPlugin from './plugins/KeyboardPlugin';
import EditableController from './plugins/EditableController';
import EditorStatePlugin from './plugins/EditorStatePlugin';
import RemoveListPlugin from './plugins/RemoveListPlugin';
// import KeywordPlugin from './plugins/KeywordPlugin';
import EditorTheme from './themes/PlaygroundEditorTheme';
import Util from './utils';

type InitialConfig = ComponentProps<typeof LexicalComposer>['initialConfig'];

type EditorProps = {
  editorState?: InitialConfig['editorState'];
  editable?: boolean;
  onEditable?: (editor: LexicalEditor) => void;
  onChange?: (editorState: EditorState, editor: LexicalEditor) => void;
  onSubmit?: () => void;
  header?: (editorRef?: MutableRefObject<LexicalEditor | undefined>) => React.ReactNode;
  footer?: (editorRef?: MutableRefObject<LexicalEditor | undefined>) => React.ReactNode;
  className?: string;
  minRows?: number;
  height?: string;
  highlightSearch?: string;
  editorRef?: MutableRefObject<LexicalEditor | undefined>;
  placeholder?: string;
};

const Editor = ({
  editorState: inputEditState,
  editable,
  onChange = () => {},
  onSubmit,
  header,
  footer,
  onEditable,
  className,
  minRows,
  height,
  highlightSearch,
  editorRef,
  placeholder,
}: EditorProps) => {
  const editorState =
    typeof inputEditState === 'string'
      ? Util.removeEvent(inputEditState)
      : inputEditState;

  const initialConfig: InitialConfig = {
    namespace: 'TNEditor',
    theme: EditorTheme,
    onError: console.error,
    editable: editable || false,
    editorState,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      AutoLinkNode,
      LinkNode,
    ],
  };

  const internalRef = useRef<LexicalEditor>();

  const ensureEditable = () => {
    const editor = internalRef.current;
    if (editor && !editor.isEditable()) {
      onEditable && onEditable(editor);
    }
  };

  const wrapperSx: Record<string, unknown> = {};
  if (height) {
    wrapperSx.height = height;
  }

  const fixHeight = !!height;

  const mainSx: Record<string, unknown> = {};
  if (fixHeight) {
    mainSx.flex = '1';
    mainSx.overflow = 'auto';
  }

  const editorSx: Record<string, unknown> = {};
  if (fixHeight) {
    editorSx.minHeight = '100%';
  } else if (minRows) {
    editorSx.minHeight = `${minRows * 2.5}rem`;
  }
  editorSx.position = 'relative';

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <Wrapper style={wrapperSx} className={className}>
        <OnChangePlugin onChange={onChange} />
        <HistoryPlugin />
        <TabIndentationPlugin />
        <MarkdownShortcutPlugin transformers={[...TRANSFORMERS, CHECK_LIST]} />
        {/* enable double enter to remove list style*/}
        <ListPlugin />
        <CheckListPlugin />

        {/* ref */}
        <EditorRefPlugin editorRef={internalRef} />
        {editorRef && <EditorRefPlugin editorRef={editorRef} />}

        {/* custom */}
        <DeleteLinePlugin />
        <RemoveListPlugin />
        <KeyboardPlugin onSubmit={onSubmit} />
        <EditableController editable={editable} />
        <AutoLinkPlugin />
        <EditorStatePlugin
          editorState={inputEditState}
          highlightSearch={editable ? '' : (highlightSearch || '').trim()}
        />
        {/* <KeywordPlugin /> */}

        {/* view */}
        <>{header && header(internalRef)}</>
        <Box sx={mainSx} onDoubleClick={ensureEditable}>
          <RichTextPlugin
            contentEditable={<ContentEditable style={editorSx} className="editable" />}
            placeholder={
              placeholder ? <div className="editor-placeholder">{placeholder}</div> : null
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </Box>
        {footer && (
          <>
            <Box mt={2} />
            <Box>{footer && footer(internalRef)}</Box>
          </>
        )}
      </Wrapper>
    </LexicalComposer>
  );
};

export default Editor;

interface StyledComponentProps {
  minRows?: number;
}

const Wrapper = styled(Box)<StyledComponentProps>(
  ({ theme }) => `
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: visible;
  background-color: ${theme.vars.palette.background.paper};
  .editable {
    outline: none;
    padding-top: 0.5rem;
  }

  .editor-placeholder {
    position: absolute;
    color: ${theme.vars.palette.text.secondary};
    overflow: hidden;
    top: 1rem;
    user-select: none;
    pointer-events: none;
  }

  .ltr {
    text-align: left;
  }

  .rtl {
    text-align: right;
  }

  .editor-paragraph {
    // margin: 0 0 15px 0;
    position: relative;
  }

  .editor-nested-listitem {
    list-style-type: none;
  }
`
);
