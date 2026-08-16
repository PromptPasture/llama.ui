<script lang="ts">
  import 'katex/dist/katex.min.css';
  import { copyStr } from '$lib/utils/dom-helpers';
  import { renderMarkdown } from '$lib/utils/markdown';

  interface Props {
    content: string;
    streaming?: boolean;
  }

  let { content, streaming = false }: Props = $props();

  const html = $derived(renderMarkdown(content));

  function handleClick(e: MouseEvent) {
    const btn = (e.target as HTMLElement).closest(
      '[data-code]'
    ) as HTMLElement | null;
    if (btn?.dataset.code !== undefined) {
      copyStr(btn.dataset.code);
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = 'Copy';
      }, 1500);
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
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised with DOMPurify above -->
  {@html html}
</div>

<style>
  .markdown :global(p) {
    margin: 0.5em 0;
  }
  .markdown :global(pre) {
    background: var(--color-bg-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0.875rem 1rem;
    overflow-x: auto;
  }
  .markdown :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
  }
  .markdown :global(p code) {
    background: var(--color-accent-soft);
    color: var(--color-accent);
    padding: 0.1em 0.4em;
    border-radius: var(--radius-sm);
  }
  .markdown :global(.table-wrapper) {
    overflow-x: auto;
    margin: 0.75rem 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .markdown :global(table) {
    border-collapse: collapse;
    width: 100%;
  }
  .markdown :global(th),
  .markdown :global(td) {
    border: 1px solid var(--color-border);
    padding: 0.375rem 0.75rem;
  }
  .markdown :global(th) {
    background: var(--color-surface-alt);
    font-weight: 600;
  }
  .markdown :global(blockquote) {
    border-left: 3px solid var(--color-accent);
    margin: 0.5rem 0;
    padding: 0.25rem 0.875rem;
    color: var(--color-text-muted);
  }
  .markdown :global(ul),
  .markdown :global(ol) {
    padding-left: 1.5rem;
    margin: 0.5rem 0;
  }
  .markdown :global(.code-block) {
    position: relative;
    margin: 0.75rem 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .markdown :global(.code-block__toolbar) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--color-surface-alt);
    padding: 0.3rem 0.75rem;
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }
  .markdown :global(.code-block__lang) {
    color: var(--color-text-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .markdown :global(.code-block__copy-btn) {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    padding: 0;
  }
  .markdown :global(.code-block__copy-btn:hover) {
    color: var(--color-text);
  }
  .markdown :global(.code-block pre) {
    margin: 0;
    border: none;
    border-radius: 0;
  }
</style>
