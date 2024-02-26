import { $isListItemNode, $isListNode, ListItemNode } from '@lexical/list';
import { mergeRegister, $getNearestNodeOfType } from '@lexical/utils';
import {
  COMMAND_PRIORITY_CRITICAL,
  KEY_DOWN_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
} from 'lexical';
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

function $isLastItemInList(listItem: ListItemNode): boolean {
  let isLast = true;
  const firstChild = listItem.getFirstChild();

  if ($isListNode(firstChild)) {
    return false;
  }
  let parent: ListItemNode | null = listItem;

  while (parent !== null) {
    if ($isListItemNode(parent)) {
      if (parent.getNextSiblings().length > 0) {
        isLast = false;
      }
    }

    parent = parent.getParent();
  }

  return isLast;
}

export default function RemoveListPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const DELETE_CODE = ['Backspace', 'Delete'].map((key) =>
            key.toLocaleLowerCase()
          );

          if (DELETE_CODE.includes(event.code.toLocaleLowerCase())) {
            const selection = $getSelection();

            if ($isRangeSelection(selection)) {
              try {
                const anchorNode = selection.anchor.getNode();
                const listItemNode = $getNearestNodeOfType(anchorNode, ListItemNode);
                const isLastItemInList = listItemNode
                  ? $isLastItemInList(listItemNode)
                  : false;

                if (isLastItemInList && listItemNode) {
                  if (!selection.anchor.offset) {
                    event.preventDefault();
                    const childrens = listItemNode.getChildren();

                    const paragraph = $createParagraphNode();
                    if (Array.isArray(childrens) && childrens.length) {
                      childrens.forEach((child) => {
                        paragraph.append(child);
                      });
                    }

                    listItemNode.insertAfter(paragraph);
                    listItemNode.remove();

                    selection.anchor.set(paragraph.getKey(), 0, 'element');
                    selection.focus.set(paragraph.getKey(), 0, 'element');

                    return true;
                  }
                }
              } catch (error) {
                console.error(error);
                return false;
              }
            }
          }

          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    );
  }, [editor]);

  return null;
}
