<script lang="ts" generics="T extends { value: string | number; label: string }">
  import { _ } from 'svelte-i18n';
  import Dropdown from '../Dropdown.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    configKey: string;
    value: string | number;
    options: T[];
    filterable?: boolean;
    renderOption?: Snippet<[T]>;
    onchange: (value: string | number) => void;
  }

  let { configKey, value, options, filterable = false, renderOption, onchange }: Props = $props();

  const label = $derived($_(`settings.parameters.${configKey}.label`, { default: configKey }));
  const note = $derived($_(`settings.parameters.${configKey}.note`, { default: '' }));
  const selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? String(value));
</script>

<div class="dropdown-field">
  <div class="dropdown-field__row">
    <span class="dropdown-field__label">{label}</span>
    <Dropdown
      entity={configKey}
      {options}
      {filterable}
      class="dropdown-field__control"
      isSelected={(o) => o.value === value}
      onSelect={(o) => onchange(o.value)}
    >
      {#snippet currentValue()}
        <span class="truncate">{selectedLabel}</span>
      {/snippet}
      {#snippet renderOption(option)}
        {#if renderOption}
          {@render renderOption(option)}
        {:else}
          <span class="truncate">{option.label}</span>
        {/if}
      {/snippet}
    </Dropdown>
  </div>
  {#if note}
    <div class="dropdown-field__note">{@html note}</div>
  {/if}
</div>

<style>
  .dropdown-field { margin-bottom: 0.75rem; }
  .dropdown-field__row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0.375rem 0.75rem;
  }
  .dropdown-field__label { font-weight: 600; font-size: 0.875rem; white-space: nowrap; flex-shrink: 0; }
  :global(.dropdown-field__control) { flex: 1; min-width: 0; }
  .dropdown-field__note { font-size: 0.75rem; color: var(--color-text-muted); max-width: 20rem; margin-top: 0.25rem; }
</style>
