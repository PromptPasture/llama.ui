import DOMPurify from 'dompurify';
import { marked, type RendererObject } from 'marked';
import markedKatex from 'marked-katex-extension';

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
    const escaped = token.text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div class="code-block" data-lang="${lang}">
        <div class="code-block__toolbar">
          ${lang ? `<span class="code-block__lang">${lang}</span>` : ''}
          <button type="button" class="code-block__copy-btn" data-code="${token.text.replace(/"/g, '&quot;')}">Copy</button>
        </div>
        <pre><code class="language-${lang}">${escaped}</code></pre>
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
