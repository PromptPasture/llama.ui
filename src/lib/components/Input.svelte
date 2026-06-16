<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Variant = 'text' | 'file' | 'input' | 'bordered' | 'toggle' | 'range';

  interface Props extends HTMLInputAttributes {
    variant?: Variant;
  }

  let { variant = 'text', class: className = '', type, ...rest }: Props = $props();

  const resolvedType = type ?? (
    variant === 'file' ? 'file' :
    variant === 'toggle' ? 'checkbox' :
    variant === 'range' ? 'range' : 'text'
  );

  const variantClass: Record<Variant, string> = {
    text: '',
    file: '',
    input: 'input',
    bordered: 'input input--bordered',
    toggle: 'toggle',
    range: 'range',
  };
</script>

<input class="{variantClass[variant]} {className}" type={resolvedType} {...rest} />

<style>
  .input {
    display: block;
    width: 100%;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .input--bordered { border-color: var(--color-border); }
  .input:focus { outline: 2px solid var(--color-accent); outline-offset: -1px; }

  .toggle {
    appearance: none;
    width: 2.5rem;
    height: 1.25rem;
    border-radius: var(--radius-full);
    background: var(--color-border);
    cursor: pointer;
    position: relative;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .toggle::after {
    content: '';
    position: absolute;
    top: 2px; left: 2px;
    width: 1rem; height: 1rem;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
  }
  .toggle:checked { background: var(--color-accent); }
  .toggle:checked::after { transform: translateX(1.25rem); }

  .range { accent-color: var(--color-accent); width: 100%; }
</style>
