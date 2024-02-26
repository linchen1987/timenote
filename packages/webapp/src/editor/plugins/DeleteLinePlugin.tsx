/**
 * Not in Production.
 * offset of selection anchor & focus may not be 0
 */

import { useLayoutEffect } from 'react';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_EDITOR, DELETE_LINE_COMMAND } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

const DeleteLinePlugin = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    return mergeRegister(
      editor.registerCommand<boolean>(
        DELETE_LINE_COMMAND,
        (isBackward) => {
          const selection = $getSelection();

          if (!$isRangeSelection(selection)) {
            return false;
          }

          // rewrite select.deleteLine

          if (selection.isCollapsed()) {
            if (selection.anchor.type === 'text') {
              selection.modify('extend', isBackward, 'lineboundary');
            }

            if (selection.anchor.offset === selection.focus.offset) {
              selection.modify('extend', isBackward, 'character');
            }
          }
          selection.removeText();

          return true;
        },
        COMMAND_PRIORITY_EDITOR
      )
    );
  }, [editor]);

  return null;
};

export default DeleteLinePlugin;
