import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { KEY_ENTER_COMMAND, COMMAND_PRIORITY_LOW } from 'lexical';

export default function SubmitKeyboardPlugin({ onSubmit }: { onSubmit?: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event && (event.metaKey || event.ctrlKey)) {
          event?.preventDefault();
          onSubmit && onSubmit();
        }
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, onSubmit]);

  return null;
}
