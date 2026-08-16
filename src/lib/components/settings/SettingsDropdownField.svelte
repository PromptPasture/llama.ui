<script
  lang="ts"
  generics="T extends { value: string | number; label: string }"
>
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

  let {
    configKey,
    value,
    options,
    filterable = false,
    renderOption,
    onchange,
  }: Props = $props();

  const label = $derived(
    $_(`settings.parameters.${configKey}.label`, { default: configKey })
  );
  const note = $derived(
    $_(`settings.parameters.${configKey}.note`, { default: '' })
  );
  const selectedLabel = $derived(
    options.find((o) => o.value === value)?.label ?? String(value)
  );
</script>

<div class="settings-dropdown">
  <div class="settings-dropdown__row">
    <span class="settings-dropdown__label">{label}</span>
    <Dropdown
      entity={configKey}
      {options}
      {filterable}
      class="settings-dropdown__control"
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
    <div class="settings-dropdown__note">{@html note}</div>
  {/if}
</div>

<style>
  @reference "tailwindcss";
  .settings-dropdown {
    @apply mb-3;
  }

  .settings-dropdown__row {
    @apply flex items-center gap-3 px-3 py-1.5;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .settings-dropdown__label {
    @apply font-semibold text-sm whitespace-nowrap shrink-0;
  }

  :global(.settings-dropdown__control) {
    @apply flex-1 min-w-0;
  }

  .settings-dropdown__note {
    @apply text-xs mt-1 max-w-80;
    color: var(--color-text-muted);
  }
</style>
