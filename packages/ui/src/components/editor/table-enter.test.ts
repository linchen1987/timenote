// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { afterEach, describe, expect, it } from 'vitest';
import { TableEnterBreak } from './markdown-editor';

let editor: Editor;

function getMarkdown() {
  return (
    editor.storage as unknown as Record<string, { getMarkdown: () => string }>
  ).markdown.getMarkdown();
}

function createEditor(content: string) {
  editor = new Editor({
    content,
    extensions: [
      StarterKit,
      Markdown.configure({ html: true, tightLists: true, linkify: true, breaks: false }),
      TableEnterBreak,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      HorizontalRule,
    ],
  });
}

// 模拟真实按键：直接在编辑器 DOM 上派发 keydown
function press(key: string, shift = false) {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true }),
  );
}

// 光标放到指定类型 cell 内文本中间（拆成两半，保证 <br> 后还有内容）
function cursorMidText(cellType: 'tableCell' | 'tableHeader') {
  let target = -1;
  editor.state.doc.descendants((node, pos) => {
    if (target >= 0) return false;
    if (node.type.name === cellType && node.firstChild) {
      target = pos + 2 + Math.floor(node.firstChild.content.size / 2);
      return false;
    }
    return true;
  });
  if (target < 0) throw new Error(`${cellType} not found`);
  editor.commands.setTextSelection(target);
}

afterEach(() => {
  editor?.destroy();
});

describe('Enter inside table cell', () => {
  it('inserts <br> in a body cell, keeping the table as GFM markdown', () => {
    createEditor('| h1 | h2 |\n| --- | --- |\n| ab | b |\n');
    cursorMidText('tableCell');
    press('Enter');

    const md = getMarkdown();
    expect(md).toContain('| a<br>b |');
    expect(md).toContain('| h1 | h2 |');
    expect(md).not.toContain('<table');
  });

  it('inserts <br> in a header cell', () => {
    createEditor('| h1 | h2 |\n| --- | --- |\n| a | b |\n');
    cursorMidText('tableHeader');
    press('Enter');

    expect(getMarkdown()).toContain('| h<br>1 |');
    expect(getMarkdown()).not.toContain('<table');
  });

  it('still splits a paragraph outside tables', () => {
    createEditor('<p>hello</p>');
    editor.commands.setTextSelection(6);
    press('Enter');

    expect(editor.state.doc.childCount).toBe(2);
    expect(getMarkdown()).toBe('hello');
  });
});
