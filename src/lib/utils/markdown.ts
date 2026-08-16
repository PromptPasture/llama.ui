import DOMPurify from 'dompurify';
import { marked, type RendererObject } from 'marked';
import markedKatex from 'marked-katex-extension';

/**
 * Escapes text for either an element's content or a quoted attribute value.
 *
 * The ampersand has to go first, or the escapes produced here would be escaped
 * again. The language comes from whatever follows the opening fence, which is
 * model output like everything else here.
 *
 * @param text - The text to escape
 * @returns The text with `&`, `<`, `>` and `"` replaced by entities
 */
const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Custom renderer: wrap tables and code blocks so they can be styled and given
 * a copy button.
 */
const renderer: RendererObject = {
  table(token) {
    const header = token.header.map((cell) => `<th>${cell.text}</th>`).join('');
    const rows = token.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${cell.text}</td>`).join('')}</tr>`
      )
      .join('');
    return `<div class="table-wrapper"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
  },
  code(token) {
    const lang = token.lang ?? '';
    const escaped = escapeHtml(token.text);
    return `<div class="code-block" data-lang="${escapeHtml(lang)}">
        <div class="code-block__toolbar">
          ${lang ? `<span class="code-block__lang">${escapeHtml(lang)}</span>` : ''}
          <button type="button" class="code-block__copy-btn">Copy</button>
        </div>
        <pre><code class="language-${escapeHtml(lang)}">${escaped}</code></pre>
      </div>`;
  },
};

// Registered once, at module scope. `marked.use` appends to marked's extension
// chain, so registering per component instance made every parse progressively
// slower as a conversation grew.
marked.use(markedKatex({ throwOnError: false }));
marked.use({ breaks: true, gfm: true });
marked.use({ renderer });

/**
 * Shields code spans and blocks from LaTeX handling, then normalises the LaTeX
 * delimiters so a lone `$` in front of a number reads as currency rather than
 * the start of a math expression.
 *
 * @param src - The raw markdown
 * @returns The markdown with LaTeX delimiters normalised
 */
export function preprocessLaTeX(src: string): string {
  const codeBlocks: string[] = [];
  let s = src.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (m) => {
    codeBlocks.push(m);
    return `<<CB_${codeBlocks.length - 1}>>`;
  });
  const latexExprs: string[] = [];
  s = s.replace(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g, (m) => {
    latexExprs.push(m);
    return `<<LX_${latexExprs.length - 1}>>`;
  });
  s = s.replace(/\$([^$]+)\$/g, (m, inner) => {
    if (/^\s*\d+(?:\.\d+)?\s*$/.test(inner)) return m;
    latexExprs.push(m);
    return `<<LX_${latexExprs.length - 1}>>`;
  });
  s = s.replace(/\$(?=\d)/g, '\\$');
  s = s.replace(/<<LX_(\d+)>>/g, (_, i) => latexExprs[+i]);
  s = s.replace(/<<CB_(\d+)>>/g, (_, i) => codeBlocks[+i]);
  return s;
}

/**
 * Renders markdown to HTML that is safe to inject with `{@html}`.
 *
 * marked passes raw HTML through untouched and this content is model output, so
 * the result is sanitised. `annotation` and `encoding` are allowed back in to
 * keep KaTeX's MathML, which holds the original TeX source.
 *
 * @param content - The markdown to render
 * @returns Sanitised HTML
 */
export function renderMarkdown(content: string): string {
  return DOMPurify.sanitize(marked.parse(preprocessLaTeX(content)) as string, {
    ADD_TAGS: ['annotation'],
    ADD_ATTR: ['encoding'],
  });
}

/**
 * The prose of a message, for reading aloud.
 *
 * Speaking the markdown itself would announce every `#`, `*` and backtick. It
 * is rendered and then flattened instead, which also drops link targets and
 * leaves the visible text.
 *
 * Two parts of the rendered output are removed rather than read:
 *
 * - the code block's toolbar, whose language tag and Copy label are chrome
 *   rather than anything the message says;
 * - KaTeX's MathML, which restates the formula both as characters and as its
 *   original TeX, so a rendered `$E = mc^2$` would otherwise be read three
 *   times over.
 *
 * @param content - The markdown to speak
 * @returns Plain text with runs of whitespace collapsed
 */
export function speechText(content: string): string {
  const el = document.createElement('div');
  el.innerHTML = renderMarkdown(content);
  el.querySelectorAll('.code-block__toolbar, .katex-mathml').forEach((node) => {
    node.remove();
  });
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}
