// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { beforeEach, describe, expect, it } from 'vitest';
import { MathBlock, MathInline } from './math';

let editor: Editor;

function getMarkdown() {
  return (
    editor.storage as unknown as Record<string, { getMarkdown: () => string }>
  ).markdown.getMarkdown();
}

function setup(content: string) {
  editor = new Editor({
    content,
    extensions: [
      StarterKit,
      Markdown.configure({ html: true, tightLists: true, breaks: false, linkify: true }),
      MathInline,
      MathBlock,
    ],
  });
  return getMarkdown();
}

beforeEach(() => {
  editor?.destroy();
});

describe('math markdown round-trip', () => {
  it('parses inline math and serializes back', () => {
    expect(setup('a $x^2$ b')).toBe('a $x^2$ b');
  });

  it('parses latex with backslashes', () => {
    expect(setup('$\\frac{1}{2}$')).toBe('$\\frac{1}{2}$');
  });

  it('parses single-line block math', () => {
    expect(setup('$$E=mc^2$$')).toBe('$$\nE=mc^2\n$$');
  });

  it('parses multi-line block math', () => {
    const md = setup('$$\nx = 1 \\\\\ny = 2\n$$');
    expect(md).toBe('$$\nx = 1 \\\\\ny = 2\n$$');
  });

  it('creates an inlineMath node from markdown', () => {
    setup('a $x^2$ b');
    expect(editor.state.doc.textContent).not.toContain('$');
    let found = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'inlineMath' && node.attrs.latex === 'x^2') found = true;
    });
    expect(found).toBe(true);
  });

  it('creates a blockMath node from markdown', () => {
    setup('$$E=mc^2$$');
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.state.doc.firstChild?.type.name).toBe('blockMath');
    expect(editor.state.doc.firstChild?.attrs.latex).toBe('E=mc^2');
  });

  it('round-trips through setContent', () => {
    setup('');
    editor.commands.setContent('value $\\pi r^2$ here');
    expect(getMarkdown()).toBe('value $\\pi r^2$ here');
  });
});

describe('math node view editing', () => {
  function openBlockMathInput() {
    setup('$$x^2$$');
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 0)));
    return editor.view.dom.querySelector<HTMLInputElement>('.tn-math__input');
  }

  function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('keeps the editor open while typing and commits on Enter', async () => {
    const input = openBlockMathInput();
    expect(input).not.toBeNull();

    type(input, 'x^3');
    expect(editor.state.doc.firstChild?.attrs.latex).toBe('x^2');
    expect(editor.view.dom.querySelector('.tn-math__input')).not.toBeNull();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();

    expect(editor.state.doc.firstChild?.attrs.latex).toBe('x^3');
    expect(editor.view.dom.querySelector('.tn-math__input')).toBeNull();
  });

  it('discards edits on Escape', async () => {
    const input = openBlockMathInput();
    type(input, 'x^9');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await Promise.resolve();

    expect(editor.state.doc.firstChild?.attrs.latex).toBe('x^2');
    expect(editor.view.dom.querySelector('.tn-math__input')).toBeNull();
  });

  it('commits and moves the cursor past the node when the input blurs', async () => {
    const input = openBlockMathInput();
    type(input, 'x^4');

    input.dispatchEvent(new Event('blur'));
    await Promise.resolve();

    expect(editor.state.doc.firstChild?.attrs.latex).toBe('x^4');
    expect(editor.state.selection instanceof NodeSelection).toBe(false);
    expect(editor.state.selection.from).toBeGreaterThanOrEqual(
      editor.state.doc.firstChild?.nodeSize ?? 0,
    );
  });
});
