<script lang="ts">
  import 'katex/dist/katex.min.css';
  import { marked, type RendererObject } from 'marked';
  import markedKatex from 'marked-katex-extension';
  import { copyStr } from '$lib/utils/dom-helpers';

  interface Props {
    content: string;
    streaming?: boolean;
  }

  let { content, streaming = false }: Props = $props();

  marked.use(markedKatex({ throwOnError: false }));
  marked.use({ breaks: true, gfm: true });

  // Custom renderer: wrap tables and code blocks
  const renderer: RendererObject = {
    table(token) {
      const header = token.header.map((cell) => `<th>${cell.text}</th>`).join('');
      const rows = token.rows.map((row) =>
        `<tr>${row.map((cell) => `<td>${cell.text}</td>`).join('')}</tr>`
      ).join('');
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
  marked.use({ renderer });

  const html = $derived(marked.parse(preprocessLaTeX(content)) as string);

  function preprocessLaTeX(src: string): string {
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

  function handleClick(e: MouseEvent) {
    const btn = (e.target as HTMLElement).closest('[data-code]') as HTMLElement | null;
    if (btn?.dataset.code !== undefined) {
      copyStr(btn.dataset.code);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="markdown"
  aria-live={streaming ? 'polite' : undefined}
  aria-atomic="false"
  onclick={handleClick}
  onkeydown={() => {}}
>
  {@html html}
</div>

<style>
  .markdown :global(p) { margin: 0.5em 0; }
  .markdown :global(pre) { background: var(--color-bg-alt); border-radius: var(--radius-md); padding: 0.75rem 1rem; overflow-x: auto; }
  .markdown :global(code) { font-family: monospace; font-size: 0.875em; }
  .markdown :global(p code) { background: var(--color-bg-alt); padding: 0.1em 0.4em; border-radius: var(--radius-sm); }
  .markdown :global(.table-wrapper) { overflow-x: auto; margin: 0.75rem 0; }
  .markdown :global(table) { border-collapse: collapse; width: 100%; }
  .markdown :global(th), .markdown :global(td) { border: 1px solid var(--color-border); padding: 0.375rem 0.75rem; }
  .markdown :global(th) { background: var(--color-surface-alt); font-weight: 600; }
  .markdown :global(blockquote) { border-left: 3px solid var(--color-border); margin: 0.5rem 0; padding: 0.25rem 0.75rem; color: var(--color-text-muted); }
  .markdown :global(ul), .markdown :global(ol) { padding-left: 1.5rem; margin: 0.5rem 0; }
  .markdown :global(.code-block) { position: relative; margin: 0.75rem 0; }
  .markdown :global(.code-block__toolbar) { display: flex; justify-content: space-between; align-items: center; background: var(--color-surface-alt); padding: 0.25rem 0.75rem; border-radius: var(--radius-md) var(--radius-md) 0 0; font-size: 0.75rem; }
  .markdown :global(.code-block__lang) { color: var(--color-text-muted); }
  .markdown :global(.code-block__copy-btn) { background: none; border: none; cursor: pointer; color: var(--color-text-muted); font-size: 0.75rem; padding: 0; }
  .markdown :global(.code-block__copy-btn:hover) { color: var(--color-text); }
  .markdown :global(.code-block pre) { margin: 0; border-radius: 0 0 var(--radius-md) var(--radius-md); }
</style>
