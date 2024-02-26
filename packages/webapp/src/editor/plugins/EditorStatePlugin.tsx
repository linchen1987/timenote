import { useEffect, useMemo } from 'react';
import type { InitialEditorStateType } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import Util from '../utils';

type Node = {
  children?: Node[];
  type: string;
  text?: string;
  key: string;
  [key: string]: unknown;
};

const findIndexes = (text: string, keyword: string) => {
  const indexes: number[] = [];
  // const lowerCaseText = text.toLowerCase();
  let index = text.indexOf(keyword);
  while (index >= 0) {
    indexes.push(index);
    index = text.indexOf(keyword, index + 1);
  }
  return indexes;
};

const highLight = (node: Node, keywords: string[], parent?: Node) => {
  if (node.type !== 'text') {
    (node.children || []).forEach((child) => {
      highLight(child, keywords, node);
    });
  } else {
    const text = node.text || '';
    const allNewNodes: Node[] = [];
    keywords.forEach((keyword) => {
      const index = text.indexOf(keyword);
      if (index >= 0) {
        const keyWorldIndexes = findIndexes(text.toLowerCase(), keyword.toLowerCase());

        // get each part of text
        const parts: { mark: boolean; text: string }[] = [];
        let lastIndex = 0;
        keyWorldIndexes.forEach((keyWorldIndex) => {
          if (keyWorldIndex > lastIndex) {
            parts.push({ mark: false, text: text.slice(lastIndex, keyWorldIndex) });
          }
          parts.push({
            mark: true,
            text: text.slice(keyWorldIndex, keyWorldIndex + keyword.length),
          });
          lastIndex = keyWorldIndex + keyword.length;
        });

        // create new nodes
        const newNodes: Node[] = [];
        parts.forEach((part) => {
          if (part) {
            newNodes.push({
              ...node,
              text: part.text,
              style: part.mark
                ? `${node.style || ''};background-color: var(--tn-highlight-bg)`
                : node.style,
              key: `${node.key}-${newNodes.length}`,
            });
          }
        });

        allNewNodes.push(...newNodes);
      }
    });

    if (parent && allNewNodes.length > 0) {
      const nodeIndex = parent.children!.findIndex((x) => x === node);
      parent.children!.splice(nodeIndex, 1, ...allNewNodes);
    }

    // support `todo hel llo`, but has bug

    // const text = node.text || '';
    // const allIndexes: { start: number; end: number }[] = [];
    // keywords.forEach((keyword) => {
    //   const keyWorldIndexes = findIndexes(text, keyword);
    //   keyWorldIndexes.forEach((index) => {
    //     allIndexes.push({ start: index, end: index + keyword.length });
    //   });
    // });

    // // sort and merge indexes
    // allIndexes.sort((a, b) => a.start - b.start);
    // const mergedIndexes: { start: number; end: number }[] = [];
    // let current = allIndexes[0];
    // for (let i = 1; i < allIndexes.length; i++) {
    //   if (allIndexes[i].start <= current.end) {
    //     current.end = Math.max(current.end, allIndexes[i].end);
    //   } else {
    //     mergedIndexes.push(current);
    //     current = allIndexes[i];
    //   }
    // }
    // mergedIndexes.push(current);

    // // get each part of text
    // const parts: { mark: boolean; text: string }[] = [];
    // let lastIndex = 0;
    // mergedIndexes.forEach((index) => {
    //   if (index.start > lastIndex) {
    //     parts.push({ mark: false, text: text.slice(lastIndex, index.start) });
    //   }
    //   parts.push({ mark: true, text: text.slice(index.start, index.end) });
    //   lastIndex = index.end;
    // });

    // // create new nodes
    // const newNodes: Node[] = [];
    // parts.forEach((part) => {
    //   if (part) {
    //     newNodes.push({
    //       ...node,
    //       text: part.text,
    //       style: part.mark
    //         ? `${node.style || ''}${
    //             node.style ? ';' : ''
    //           }background-color: var(--tn-highlight-bg);`
    //         : node.style,
    //       key: `${node.key}-${newNodes.length}`,
    //     });
    //   }
    // });

    // if (parent && newNodes.length > 0) {
    //   console.log(parent);
    //   const nodeIndex = parent.children!.findIndex((x) => x === node);
    //   parent.children!.splice(nodeIndex, 1, ...newNodes);
    // }
  }
};

const getHighLightedContent = (editorState: string, search: string): string => {
  const keywords = search.split(/\s+/g).filter((x) => x);
  if (!keywords?.length || !editorState) {
    return editorState;
  }
  try {
    const newState = JSON.parse(editorState);
    highLight(newState.root, keywords);
    return JSON.stringify(newState);
  } catch (error) {
    console.error(error);
  }
  return editorState;
};

const EditorStatePlugin = ({
  editorState: inputEditState,
  highlightSearch = '',
}: {
  editorState?: InitialEditorStateType;
  highlightSearch: string;
}) => {
  const [editor] = useLexicalComposerContext();

  const search = useMemo(() => (highlightSearch || '').trim(), [highlightSearch]);

  useEffect(() => {
    const editorState =
      typeof inputEditState === 'string'
        ? Util.removeEvent(inputEditState)
        : inputEditState;
    if (editor && editorState) {
      if (typeof editorState === 'string') {
        const state = search ? getHighLightedContent(editorState, search) : editorState;
        editor.setEditorState(editor.parseEditorState(state));
        if (editor.isEditable()) {
          editor.focus();
        }
      }
    }
  }, [inputEditState, search, editor]);

  return null;
};

export default EditorStatePlugin;
