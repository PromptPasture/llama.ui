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

  let el: HTMLTextAreaElement;

  /**
   * Puts the cursor at the end of what is already written.
   *
   * A caller that opens an editor needs this: the box appears with the text in
   * it, and without being asked the cursor stays wherever it was, so the first
   * thing to do is click into a box that is already on screen.
   */
  export function focusEnd(): void {
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }

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
  class="textarea textarea--{variant} {className}"
  oninput={resize}
  dir="auto"
  {...rest}></textarea>

<style>
  @reference "tailwindcss";
  .textarea {
    @apply block w-full px-3 py-2 text-sm leading-6;
    color: var(--color-text);
  }

  .textarea--bordered,
  .textarea--code {
    @apply resize-y min-h-12;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }
  .textarea--bordered:focus,
  .textarea--code:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: -1px;
  }

  .textarea--code {
    @apply font-mono;
  }

  .textarea--transparent {
    @apply resize-none outline-none;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
  }
  .textarea--transparent:focus {
    outline: none;
  }
</style>
