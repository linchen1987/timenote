import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { TagList } from './tag-list'

export const createTagSuggestion = (getTags: () => string[]) => ({
  char: '#',
  items: ({ query }: { query: string }) => {
    return getTags()
      .filter(item => item.toLowerCase().startsWith(query.toLowerCase()))
      .slice(0, 10)
  },

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
      .run()
  },

  render: () => {
    let component: ReactRenderer<any>
    let popup: TippyInstance[]

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(TagList, {
          props,
          editor: props.editor,
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })
      },

      onUpdate(props: any) {
        component.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        })
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide()
          return true
        }

        return component.ref?.onKeyDown(props)
      },

      onExit() {
        popup[0].destroy()
        component.destroy()
      },
    }
  },
})
