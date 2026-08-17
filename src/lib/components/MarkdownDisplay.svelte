<script lang="ts">
  import { untrack } from 'svelte';
  import 'katex/dist/katex.min.css';
  import { _ } from 'svelte-i18n';
  import { copyStr } from '$lib/utils/dom-helpers';
  import { toast } from '$lib/components/toast';
  import { renderMarkdown } from '$lib/utils/markdown';

  interface Props {
    content: string;
    streaming?: boolean;
  }

  let { content, streaming = false }: Props = $props();

  /**
   * How often to re-read a reply that is still arriving.
   *
   * Parsing is over the whole reply each time, so the cost of a chunk grows
   * with everything before it: measured, one parse of a 64 KB answer takes
   * about 70ms, and doing that per token blocks the page for the length of the
   * reply — nothing scrolls, and the stop button answers late. Eight times a
   * second still reads as arriving.
   */
  const WHILE_STREAMING_MS = 120;

  /** The text last parsed, which trails the reply while it is arriving. The
   * first value is the reply as it stands; the effect below keeps up. */
  let parsed = $state(untrack(() => content));
  let waiting: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const latest = content;
    if (!streaming) {
      // Finished: whatever came last has to be shown, not the last sample.
      clearTimeout(waiting);
      waiting = undefined;
      parsed = latest;
      return;
    }
    if (waiting) return;
    waiting = setTimeout(() => {
      waiting = undefined;
      parsed = content;
    }, WHILE_STREAMING_MS);
  });

  $effect(() => () => clearTimeout(waiting));

  // Depends on the locale as well as the content, so the button is relabelled
  // when the language changes rather than keeping the wording it was rendered
  // with.
  const html = $derived(
    renderMarkdown(parsed, { copy: $_('chatScreen.titles.copy') })
  );

  async function handleClick(e: MouseEvent) {
    const btn = (e.target as HTMLElement).closest<HTMLElement>(
      '.code-block__copy-btn'
    );
    if (!btn) return;

    // Read the code off the block itself. Carrying a copy of it in an
    // attribute meant escaping it correctly for two places at once, and
    // DOMPurify dropped the attribute outright when the code looked like
    // markup — leaving a button that did nothing.
    const code = btn
      .closest('.code-block')
      ?.querySelector('pre code')?.textContent;
    if (code === null || code === undefined) return;

    // Said only once it has happened: the clipboard refuses for ordinary
    // reasons, and the button used to report a success it never checked.
    if (!(await copyStr(code))) {
      toast.error($_('chatScreen.errors.copyFailed'));
      return;
    }
    btn.textContent = $_('chatScreen.titles.copied', { default: 'Copied!' });
    setTimeout(() => {
      btn.textContent = $_('chatScreen.titles.copy');
    }, 1500);
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
    border-inline-start: 3px solid var(--color-accent);
    margin: 0.5rem 0;
    padding: 0.25rem 0.875rem;
    color: var(--color-text-muted);
  }
  .markdown :global(ul),
  .markdown :global(ol) {
    padding-inline-start: 1.5rem;
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
