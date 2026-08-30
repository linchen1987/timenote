import { InputRule, type NodeViewRendererProps } from '@tiptap/core';
import { BlockMath, InlineMath } from '@tiptap/extension-mathematics';
import { TextSelection } from '@tiptap/pm/state';
import type { KatexOptions } from 'katex';
import katex from 'katex';
import type { MarkdownNodeSpec } from 'tiptap-markdown';
import 'katex/dist/katex.min.css';
import { mathPlugin } from './markdown-it-math';

// Same shape as the markdown-it inline rule, non-sticky: applied to the text
// before the cursor as the user types the closing '$'.
const INLINE_MATH_INPUT = /(?:^|[^$])\$(?!\s)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?![\d$])/;
const BLOCK_MATH_INPUT = /^\$\$([^$\n]+)\$\$$/;

function latexOf(node: NodeViewRendererProps['node']): string {
  return (node.attrs.latex as string | undefined) ?? '';
}

function createMathNodeView(
  props: NodeViewRendererProps,
  config: { inline: boolean; katexOptions?: KatexOptions },
) {
  const { editor, getPos } = props;
  let node = props.node;
  let input: HTMLInputElement | null = null;

  const wrapper = document.createElement(config.inline ? 'span' : 'div');
  wrapper.classList.add('tn-math', config.inline ? 'tn-math--inline' : 'tn-math--block');
  wrapper.dataset.type = config.inline ? 'inline-math' : 'block-math';
  if (editor.isEditable) {
    wrapper.classList.add('tn-math--editable');
  }

  const output = document.createElement(config.inline ? 'span' : 'div');
  output.className = 'tn-math__output';
  wrapper.appendChild(output);

  const render = () => {
    const latex = latexOf(node);
    try {
      katex.render(latex, output, { throwOnError: false, ...config.katexOptions });
      wrapper.classList.remove('tn-math--error');
    } catch {
      output.textContent = latex;
      wrapper.classList.add('tn-math--error');
    }
  };

  // Uncommitted latex while the input is open. Keystrokes are never dispatched
  // directly: every transaction makes the view write its selection back to the
  // DOM, which pulls focus out of the input and closes the editor after the
  // first character. The draft is committed once, when the editor closes.
  let draft: string | null = null;

  // The input is removed and the cursor moved past the node; keeping the
  // NodeSelection would make a second click a no-op (selectNode never fires).
  // The commit is deferred to a microtask because deselectNode runs in the
  // middle of a view update, where dispatching synchronously is not allowed.
  const closeEditor = (moveSelection: boolean, refocus = false) => {
    if (!input) return;
    input.remove();
    input = null;
    render();
    const pending = draft;
    draft = null;
    if (editor.isDestroyed) return;
    queueMicrotask(() => {
      if (editor.isDestroyed) return;
      const pos = getPos();
      if (typeof pos !== 'number') return;
      const tr = editor.state.tr;
      if (pending !== null && pending !== latexOf(node)) {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex: pending });
      }
      if (moveSelection) {
        tr.setSelection(TextSelection.near(tr.doc.resolve(pos + node.nodeSize), 1));
      }
      if (tr.docChanged || tr.selectionSet) editor.view.dispatch(tr);
      if (refocus && moveSelection) editor.commands.focus();
    });
  };

  const openEditor = () => {
    if (input || !editor.isEditable || editor.isDestroyed) return;
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'tn-math__input';
    input.value = latexOf(node);
    input.spellcheck = false;
    input.addEventListener('input', () => {
      draft = input?.value ?? null;
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        closeEditor(true, true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        draft = null;
        closeEditor(true);
      }
    });
    input.addEventListener('blur', () => closeEditor(true));
    wrapper.appendChild(input);
    input.focus();
    input.select();
  };

  render();

  return {
    dom: wrapper,
    selectNode() {
      wrapper.classList.add('tn-math--selected');
      openEditor();
    },
    deselectNode() {
      wrapper.classList.remove('tn-math--selected');
      closeEditor(false);
    },
    update(updatedNode: NodeViewRendererProps['node']) {
      if (updatedNode.type !== node.type) return false;
      node = updatedNode;
      if (!input) render();
      return true;
    },
    ignoreMutation() {
      return true;
    },
    stopEvent(event: Event) {
      return input !== null && event.target instanceof Node && wrapper.contains(event.target);
    },
    destroy() {
      input?.remove();
      input = null;
    },
  };
}

const inlineMathMarkdown: MarkdownNodeSpec = {
  // state.write is raw output: the LaTeX source must not be escaped
  serialize(state, node) {
    state.write(`$${latexOf(node as NodeViewRendererProps['node'])}$`);
  },
  parse: {
    setup(md) {
      mathPlugin(md);
    },
  },
};

const blockMathMarkdown: MarkdownNodeSpec = {
  serialize(state, node) {
    state.write(`$$\n${latexOf(node as NodeViewRendererProps['node'])}\n$$`);
    state.closeBlock(node);
  },
  parse: {
    setup(md) {
      mathPlugin(md);
    },
  },
};

export const MathInline = InlineMath.extend({
  addStorage() {
    return { markdown: inlineMathMarkdown };
  },
  addNodeView() {
    const katexOptions = this.options.katexOptions;
    return (props: NodeViewRendererProps) =>
      createMathNodeView(props, { inline: true, katexOptions });
  },
  addInputRules() {
    return [
      new InputRule({
        find: INLINE_MATH_INPUT,
        handler: ({ state, range, match }) => {
          const start = range.from + match[0].indexOf('$');
          state.tr.replaceWith(start, range.to, this.type.create({ latex: match[1] }));
        },
      }),
    ];
  },
});

export const MathBlock = BlockMath.extend({
  addStorage() {
    return { markdown: blockMathMarkdown };
  },
  addNodeView() {
    const katexOptions = this.options.katexOptions;
    return (props: NodeViewRendererProps) =>
      createMathNodeView(props, { inline: false, katexOptions });
  },
  addInputRules() {
    return [
      new InputRule({
        find: BLOCK_MATH_INPUT,
        handler: ({ state, range, match }) => {
          state.tr.replaceWith(range.from, range.to, this.type.create({ latex: match[1].trim() }));
        },
      }),
    ];
  },
});
