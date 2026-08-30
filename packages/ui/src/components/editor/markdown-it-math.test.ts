import MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { mathPlugin } from './markdown-it-math';

const md = MarkdownIt({ html: true, linkify: true, breaks: false });
md.use(mathPlugin);

const inline = (latex: string) => `<span data-type="inline-math" data-latex="${latex}"></span>`;
const block = (latex: string) => `<div data-type="block-math" data-latex="${latex}"></div>`;

describe('mathPlugin inline', () => {
  it('parses $...$ within a paragraph', () => {
    expect(md.render('a $x^2$ b')).toBe(`<p>a ${inline('x^2')} b</p>\n`);
  });

  it('keeps latex backslashes intact', () => {
    expect(md.render('$\\alpha + \\beta$')).toBe(`<p>${inline('\\alpha + \\beta')}</p>\n`);
  });

  it('parses multiple formulas on one line', () => {
    expect(md.render('$a$ and $b$')).toBe(`<p>${inline('a')} and ${inline('b')}</p>\n`);
  });

  it('leaves escaped \\$ as literal text', () => {
    expect(md.render('\\$5 and \\$6')).toBe('<p>$5 and $6</p>\n');
  });

  it('ignores currency-like dollars', () => {
    expect(md.render('价格 $5，$6 元')).not.toContain('inline-math');
    expect(md.render('between $5 and $6 dollars')).not.toContain('inline-math');
  });

  it('ignores $ with adjacent spaces', () => {
    expect(md.render('a $ x $ b')).not.toContain('inline-math');
  });

  it('ignores $$ that belongs to block syntax', () => {
    expect(md.render('see $$x$$ below')).not.toContain('inline-math');
  });

  it('escapes html inside the data-latex attribute', () => {
    expect(md.render('$a<b$')).toBe(
      `<p><span data-type="inline-math" data-latex="a&lt;b"></span></p>\n`,
    );
    expect(md.render('$x="y"$')).toContain('data-latex="x=&quot;y&quot;"');
  });

  it('parses math inside list items', () => {
    expect(md.render('- item $x$')).toContain(inline('x'));
  });
});

describe('mathPlugin block', () => {
  it('parses a single-line $$...$$', () => {
    expect(md.render('$$E=mc^2$$')).toBe(`${block('E=mc^2')}\n`);
  });

  it('parses a multi-line block with closing $$ on its own line', () => {
    const src = '$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$';
    // & is escaped in the attribute; DOMParser restores it when reading data-latex
    const attr = '\\begin{aligned}\nx &amp;= 1 \\\\\ny &amp;= 2\n\\end{aligned}';
    expect(md.render(src)).toBe(`${block(attr)}\n`);
  });

  it('parses a block whose closing $$ trails content', () => {
    expect(md.render('$$\nx = 1 $$')).toBe(`${block('x = 1')}\n`);
  });

  it('keeps surrounding paragraphs separate', () => {
    const html = md.render('before\n\n$$x$$\n\nafter');
    expect(html).toBe(`<p>before</p>\n${block('x')}\n<p>after</p>\n`);
  });

  it('parses a block inside a blockquote', () => {
    expect(md.render('> $$x$$')).toContain(block('x'));
  });

  it('leaves an unclosed $$ as plain text', () => {
    expect(md.render('$$oops')).toBe('<p>$$oops</p>\n');
    expect(md.render('$$\nnever closed')).not.toContain('block-math');
  });

  it('parses an empty block', () => {
    expect(md.render('$$\n$$')).toBe(`${block('')}\n`);
  });
});
