<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  type Variant = 'bordered' | 'code' | 'transparent';

  interface Props extends HTMLTextareaAttributes {
    variant?: Variant;
    autoresize?: boolean;
  }

  let {
    variant = 'bordered',
    autoresize = false,
    class: className = '',
    value = $bindable(''),
    ...rest
  }: Props = $props();

  const variantClass: Record<Variant, string> = {
    bordered: 'textarea',
    code: 'textarea textarea--code',
    transparent: 'textarea textarea--transparent',
  };

  let el: HTMLTextAreaElement;

  function resize() {
    if (!autoresize || !el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }

  $effect(() => {
    if (value !== undefined) resize();
  });
</script>

<textarea
  bind:this={el}
  bind:value
  class="{variantClass[variant]} {className}"
  oninput={resize}
  dir="auto"
  {...rest}
></textarea>

<style>
  .textarea {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    line-height: 1.5;
    resize: vertical;
    min-height: 3rem;
  }
  .textarea:focus { outline: 2px solid var(--color-accent); outline-offset: -1px; }
  .textarea--code { font-family: monospace; }
  .textarea--transparent {
    background: transparent;
    border-color: transparent;
    resize: none;
    outline: none;
  }
  .textarea--transparent:focus { outline: none; }
</style>
