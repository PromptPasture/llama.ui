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

  let { variant = 'default', size = 'default', class: className = '', children, ...rest }: Props = $props();

  const variantClass: Record<Variant, string> = {
    default: 'btn',
    neutral: 'btn btn--neutral',
    ghost: 'btn btn--ghost',
    danger: 'btn btn--danger',
    'menu-item': 'btn btn--ghost btn--menu-item',
  };

  const sizeClass: Record<Size, string> = {
    default: '',
    small: 'btn--sm',
    icon: 'btn--icon',
    'icon-sm': 'btn--icon-sm',
    'icon-md': 'btn--icon-md',
    'icon-xl': 'btn--icon-xl',
  };
</script>

<button
  type="button"
  class="{variantClass[variant]} {sizeClass[size]} {className}"
  dir="auto"
  {...rest}
>
  {#if children}{@render children()}{/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    background: var(--color-accent);
    color: var(--color-accent-fg);
    transition: background 0.15s, opacity 0.15s;
    line-height: 1;
  }
  .btn:hover { background: var(--color-accent-hover); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn--neutral { background: var(--color-surface-alt); color: var(--color-text); border-color: var(--color-border); }
  .btn--neutral:hover { background: var(--color-border); }
  .btn--ghost { background: transparent; color: var(--color-text); }
  .btn--ghost:hover { background: var(--color-surface-alt); }
  .btn--danger { background: var(--color-danger); color: var(--color-danger-fg); }
  .btn--danger:hover { opacity: 0.85; }
  .btn--menu-item { justify-content: flex-start; font-weight: 400; border-radius: var(--radius-sm); }

  .btn--sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
  .btn--icon { width: 2rem; height: 2rem; padding: 0; border-radius: var(--radius-md); }
  .btn--icon-sm { width: 1rem; height: 1rem; padding: 0; border-radius: var(--radius-full); font-size: 0.625rem; }
  .btn--icon-md { width: 1.25rem; height: 1.25rem; padding: 0; border-radius: var(--radius-full); }
  .btn--icon-xl { width: 2rem; height: 2rem; padding: 0; border-radius: var(--radius-full); }
</style>
