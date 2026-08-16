<script lang="ts">
  import type { FormEventHandler, HTMLInputAttributes } from 'svelte/elements';

  type Variant = 'text' | 'file' | 'input' | 'bordered' | 'toggle' | 'range';

  interface Props extends HTMLInputAttributes {
    variant?: Variant;
  }

  let {
    variant = 'text',
    class: className = '',
    type,
    value = $bindable(''),
    oninput,
    ...rest
  }: Props = $props();

  const resolvedType = $derived(
    type ??
      (variant === 'file'
        ? 'file'
        : variant === 'toggle'
          ? 'checkbox'
          : variant === 'range'
            ? 'range'
            : 'text')
  );

  // `bind:value` requires a static `type`, which this component resolves at
  // runtime, so the write-back is wired by hand. The caller's own `oninput`
  // still runs afterwards.
  const handleInput: FormEventHandler<HTMLInputElement> = (event) => {
    value = event.currentTarget.value;
    oninput?.(event);
  };
</script>

<input
  class="input input--{variant} {className}"
  type={resolvedType}
  {value}
  oninput={handleInput}
  {...rest}
/>

<style>
  @reference "tailwindcss";
  .input--input,
  .input--bordered {
    @apply block w-full px-3 py-1.5 text-sm leading-6;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text);
  }
  .input--input:focus,
  .input--bordered:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: -1px;
  }

  .input--range {
    @apply w-full;
    accent-color: var(--color-accent);
  }

  .input--toggle {
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
  .input--toggle::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
  }
  .input--toggle:checked {
    background: var(--color-accent);
  }
  .input--toggle:checked::after {
    transform: translateX(1.25rem);
  }
</style>
