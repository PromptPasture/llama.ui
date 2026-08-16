<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Variant = 'default' | 'neutral' | 'ghost' | 'danger' | 'menu-item';
  type Size = 'default' | 'small' | 'icon' | 'icon-sm' | 'icon-md' | 'icon-xl';

  interface Props extends HTMLButtonAttributes {
    variant?: Variant;
    size?: Size;
    children?: Snippet;
  }

  let {
    variant = 'default',
    size = 'default',
    class: className = '',
    children,
    ...rest
  }: Props = $props();
</script>

<button
  type="button"
  class="btn btn--{variant} btn--size-{size} {className}"
  dir="auto"
  {...rest}
>
  {#if children}{@render children()}{/if}
</button>

<style>
  @reference "tailwindcss";
  .btn {
    @apply inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-transparent text-sm font-medium cursor-pointer leading-none transition-[background,opacity] duration-150 disabled:opacity-40 disabled:cursor-not-allowed;
    border-radius: var(--radius-md);
  }

  .btn--default {
    background: var(--color-accent);
    color: var(--color-accent-fg);
  }
  .btn--default:hover {
    background: var(--color-accent-hover);
  }

  .btn--neutral {
    border-color: var(--color-border);
    background: var(--color-surface-alt);
    color: var(--color-text);
  }
  .btn--neutral:hover {
    background: var(--color-border);
  }

  .btn--ghost {
    background: transparent;
    color: var(--color-text);
  }
  .btn--ghost:hover {
    background: var(--color-surface-alt);
  }

  .btn--danger {
    background: var(--color-danger);
    color: var(--color-danger-fg);
  }
  .btn--danger:hover {
    opacity: 0.85;
  }

  .btn--menu-item {
    @apply items-start justify-start font-normal w-full;
    background: transparent;
    color: var(--color-text);
    border-radius: var(--radius-sm);
  }
  .btn--menu-item:hover {
    background: var(--color-surface-alt);
  }

  .btn--size-small {
    @apply px-2 py-1 text-xs;
  }
  .btn--size-icon {
    @apply w-8 h-8 p-0;
    border-radius: var(--radius-md);
  }
  .btn--size-icon-sm {
    width: 1rem;
    height: 1rem;
    padding: 0;
    font-size: 0.625rem;
    border-radius: var(--radius-full);
  }
  .btn--size-icon-md {
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    border-radius: var(--radius-full);
  }
  .btn--size-icon-xl {
    @apply w-8 h-8 p-0;
    border-radius: var(--radius-full);
  }
</style>
