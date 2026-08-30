// markdown-it plugin bridging $...$ / $$...$$ math syntax to the DOM structure
// expected by the tiptap math nodes (inlineMath / blockMath).
//
// Inline: $x^2$ — pandoc-style delimiters: opening '$' not followed by
// whitespace, closing '$' not preceded by whitespace and not followed by a
// digit (avoids "price $5, fee $6" being read as a formula). \$ escapes are
// left to markdown-it's built-in escape rule.
// Block: a line starting with $$, closed by $$ at the end of the same line or
// of any following line. The text between is raw LaTeX, joined with \n.

interface MathToken {
  block?: boolean;
  content: string;
  markup?: string;
  map?: [number, number];
}

interface MathBlockState {
  src: string;
  bMarks: number[];
  eMarks: number[];
  tShift: number[];
  line: number;
  push(type: string, tag: string, nesting: number): MathToken;
}

interface MathInlineState {
  src: string;
  pos: number;
  push(type: string, tag: string, nesting: number): MathToken;
}

interface MarkdownLike {
  block: {
    ruler: {
      before(
        before: string,
        ruleName: string,
        fn: (state: MathBlockState, startLine: number, endLine: number, silent: boolean) => boolean,
        options?: { alt?: string[] },
      ): void;
    };
  };
  inline: {
    ruler: {
      after(
        after: string,
        ruleName: string,
        fn: (state: MathInlineState, silent: boolean) => boolean,
      ): void;
    };
  };
  renderer: {
    rules: Record<string, ((tokens: MathToken[], idx: number) => string) | undefined>;
  };
}

// sticky: exec() is anchored at state.pos instead of searching the whole source
const INLINE_MATH_PATTERN = /\$(?![\s$])((?:\\.|[^\\$\n])+?)(?<!\s)\$(?![\d$])/y;

const BLOCK_DELIMITER = '$$';

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// index of the closing $$ on a line, or -1; only trailing whitespace may follow
function findClosingDelimiter(line: string): number {
  const trimmed = line.replace(/[ \t]+$/, '');
  return trimmed.endsWith(BLOCK_DELIMITER) ? trimmed.length - BLOCK_DELIMITER.length : -1;
}

function pushMathBlock(
  state: MathBlockState,
  startLine: number,
  nextLine: number,
  latex: string,
): void {
  state.line = nextLine;
  const token = state.push('math_block', 'div', 0);
  token.block = true;
  token.markup = BLOCK_DELIMITER;
  token.map = [startLine, nextLine];
  token.content = latex;
}

function mathBlockRule(
  state: MathBlockState,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const firstLineEnd = state.eMarks[startLine];
  if (start + BLOCK_DELIMITER.length > firstLineEnd) return false;
  if (state.src.slice(start, start + BLOCK_DELIMITER.length) !== BLOCK_DELIMITER) return false;

  const firstLine = state.src.slice(start + BLOCK_DELIMITER.length, firstLineEnd);

  // single-line form: $$ x^2 $$
  const closeOnFirstLine = findClosingDelimiter(firstLine);
  if (closeOnFirstLine >= 0) {
    if (silent) return true;
    pushMathBlock(state, startLine, startLine + 1, firstLine.slice(0, closeOnFirstLine).trim());
    return true;
  }

  // multi-line form: closing $$ sits at the end of a later line
  const lines = [firstLine];
  for (let next = startLine + 1; next < endLine; next++) {
    const lineStart = state.bMarks[next] + state.tShift[next];
    const line = state.src.slice(lineStart, state.eMarks[next]);
    const closeAt = findClosingDelimiter(line);
    if (closeAt >= 0) {
      if (silent) return true;
      lines.push(line.slice(0, closeAt));
      pushMathBlock(state, startLine, next + 1, lines.join('\n').trim());
      return true;
    }
    lines.push(line);
  }
  // no closing delimiter: leave the text to the paragraph rule
  return false;
}

function mathInlineRule(state: MathInlineState, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;
  INLINE_MATH_PATTERN.lastIndex = state.pos;
  const match = INLINE_MATH_PATTERN.exec(state.src);
  if (!match) return false;
  if (!silent) {
    const token = state.push('math_inline', 'span', 0);
    token.markup = '$';
    token.content = match[1];
  }
  state.pos += match[0].length;
  return true;
}

const PLUGIN_FLAG = '@timenote/math';

// tiptap-markdown re-runs parse.setup() on every parse, so registration must be idempotent
export function mathPlugin(md: unknown): void {
  const instance = md as MarkdownLike & { [PLUGIN_FLAG]?: boolean };
  if (instance[PLUGIN_FLAG]) return;
  instance[PLUGIN_FLAG] = true;

  instance.block.ruler.before('paragraph', 'math_block', mathBlockRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  instance.inline.ruler.after('escape', 'math_inline', mathInlineRule);
  instance.renderer.rules.math_block = (tokens, idx) =>
    `<div data-type="block-math" data-latex="${escapeAttr(tokens[idx].content)}"></div>\n`;
  instance.renderer.rules.math_inline = (tokens, idx) =>
    `<span data-type="inline-math" data-latex="${escapeAttr(tokens[idx].content)}"></span>`;
}
