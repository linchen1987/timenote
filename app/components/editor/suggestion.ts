import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { TagList } from '~/components/editor/tag-list';

export const createTagSuggestion = (getTags: () => string[]) => ({
  char: '#',
  items: ({ query }: { query: string }) => {
    return getTags()
      .filter((item) => item.toLowerCase().startsWith(query.toLowerCase()))
      .slice(0, 10);
  },

  // biome-ignore lint/suspicious/noExplicitAny: Tiptap suggestion command props are complex
  command: ({ editor, range, props }: any) => {
    // 插入纯文本 #tagname
    editor
      .chain()
      .focus()
      .insertContentAt(range, [
        {
          type: 'text',
          text: `#${props.id} `,
        },
      ])
      .run();
  },

  render: () => {
    // biome-ignore lint/suspicious/noExplicitAny: Tiptap ReactRenderer props
    let component: ReactRenderer<any>;
    let popup: TippyInstance[];

    return {
      // biome-ignore lint/suspicious/noExplicitAny: Tiptap suggestion props
      onStart: (props: any) => {
        component = new ReactRenderer(TagList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      // biome-ignore lint/suspicious/noExplicitAny: Tiptap suggestion props
      onUpdate(props: any) {
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      // biome-ignore lint/suspicious/noExplicitAny: Tiptap suggestion props
      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }

        return component.ref?.onKeyDown(props);
      },

      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  },
});
