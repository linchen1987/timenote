// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
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
