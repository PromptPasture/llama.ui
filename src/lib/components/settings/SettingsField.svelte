<script lang="ts">
  /**
   * Generic settings field: wraps short text input, long textarea, checkbox, or range.
   */
  import { _ } from 'svelte-i18n';
  import { CONFIG_DEFAULT } from '$lib/config';
  import type { ConfigurationKey } from '$lib/types';
  import Input from '../Input.svelte';
  import Textarea from '../Textarea.svelte';

  type FieldType = 'short' | 'long' | 'checkbox' | 'range';

  interface RangeProps {
    min: number;
    max: number;
    step: number;
  }

  interface Props {
    type: FieldType;
    configKey: ConfigurationKey;
    value: string | number | boolean;
    disabled?: boolean;
    range?: RangeProps;
    onchange: (value: string | number | boolean) => void;
  }

  let {
    type,
    configKey,
    value,
    disabled = false,
    range,
    onchange,
  }: Props = $props();

  const label = $derived(
    $_(`settings.parameters.${configKey}.label`, { default: configKey })
  );
  const note = $derived(
    $_(`settings.parameters.${configKey}.note`, { default: '' })
  );
  const defaultVal = CONFIG_DEFAULT[configKey];
</script>

<div class="field">
  {#if type === 'checkbox'}
    <label class="field__checkbox">
      <Input
        variant="toggle"
        checked={value as boolean}
        {disabled}
        onchange={(e) => onchange((e.target as HTMLInputElement).checked)}
      />
      <span class="field__checkbox-label">{label}</span>
    </label>
  {:else if type === 'short'}
    <div class="field__row">
      <span class="field__row-label">{label}</span>
      <Input
        variant="bordered"
        value={String(value)}
        placeholder={`Default: ${defaultVal ?? 'none'}`}
        {disabled}
        oninput={(e) => onchange((e.target as HTMLInputElement).value)}
      />
    </div>
  {:else if type === 'long'}
    <div class="field__col">
      <span class="field__col-label">{label}</span>
      <Textarea
        value={String(value)}
        placeholder={`Default: ${defaultVal ?? 'none'}`}
        {disabled}
        oninput={(e) => onchange((e.target as HTMLTextAreaElement).value)}
      />
    </div>
  {:else if type === 'range' && range}
    <div class="field__row">
      <span class="field__row-label">{label}</span>
      <Input
        variant="range"
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={String(value)}
        {disabled}
        oninput={(e) => onchange((e.target as HTMLInputElement).value)}
      />
    </div>
  {/if}

  {#if note}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- note is a translation string from src/lib/i18n, not user input; it carries markup for links -->
    <div class="field__note">{@html note}</div>
  {/if}
</div>

<style>
  @reference "tailwindcss";
  .field {
    @apply mb-3;
  }

  .field__checkbox {
    @apply flex items-center gap-2 cursor-pointer;
  }

  .field__checkbox-label {
    @apply text-sm;
  }

  .field__row {
    @apply flex items-center gap-3 px-3 py-1.5;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .field__row-label {
    @apply font-semibold text-sm whitespace-nowrap shrink-0;
  }

  .field__col {
    @apply flex flex-col gap-1;
  }

  .field__col-label {
    @apply text-xs;
    color: var(--color-text-muted);
  }

  .field__note {
    @apply text-xs mt-1 max-w-80;
    color: var(--color-text-muted);
  }
</style>
