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

  interface RangeProps { min: number; max: number; step: number; }

  interface Props {
    type: FieldType;
    configKey: ConfigurationKey;
    value: string | number | boolean;
    disabled?: boolean;
    range?: RangeProps;
    onchange: (value: string | number | boolean) => void;
  }

  let { type, configKey, value, disabled = false, range, onchange }: Props = $props();

  const label = $derived($_(`settings.parameters.${configKey}.label`, { default: configKey }));
  const note = $derived($_(`settings.parameters.${configKey}.note`, { default: '' }));
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
      <span class="field__label">{label}</span>
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
      <span class="field__label-muted">{label}</span>
      <Textarea
        value={String(value)}
        placeholder={`Default: ${defaultVal ?? 'none'}`}
        {disabled}
        oninput={(e) => onchange((e.target as HTMLTextAreaElement).value)}
      />
    </div>
  {:else if type === 'range' && range}
    <div class="field__row">
      <span class="field__label">{label}</span>
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
    <div class="field__note">{@html note}</div>
  {/if}
</div>

<style>
  .field { margin-bottom: 0.75rem; }
  .field__checkbox { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
  .field__checkbox-label { font-size: 0.875rem; }
  .field__row { display: flex; align-items: center; gap: 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.375rem 0.75rem; }
  .field__col { display: flex; flex-direction: column; gap: 0.25rem; }
  .field__label { font-weight: 600; font-size: 0.875rem; white-space: nowrap; flex-shrink: 0; }
  .field__label-muted { font-size: 0.75rem; color: var(--color-text-muted); }
  .field__note { font-size: 0.75rem; color: var(--color-text-muted); max-width: 20rem; margin-top: 0.25rem; }
</style>
