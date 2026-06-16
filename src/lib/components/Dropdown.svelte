<script lang="ts" generics="T extends { value: string | number; label: string }">
  import type { Snippet } from 'svelte';
  import { _ } from 'svelte-i18n';
  import Button from './Button.svelte';

  interface Props {
    entity: string;
    options: T[];
    filterable?: boolean;
    hideChevron?: boolean;
    align?: 'start' | 'end';
    class?: string;
    currentValue: Snippet;
    renderOption: Snippet<[T]>;
    isSelected: (option: T) => boolean;
    onSelect: (option: T) => void;
  }

  let {
    entity,
    options,
    filterable = false,
    hideChevron = false,
    align = 'end',
    class: className = '',
    currentValue,
    renderOption,
    isSelected,
    onSelect,
  }: Props = $props();

  let open = $state(false);
  let filter = $state('');

  const isDisabled = $derived(options.length < 2);

  const filteredOptions = $derived(
    !filterable || filter.trim() === ''
      ? options
      : options.filter((o) => o.label.toLowerCase().includes(filter.trim().toLowerCase()))
  );

  function select(option: T) {
    onSelect(option);
    open = false;
    filter = '';
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }
</script>

<svelte:window on:keydown={onkeydown} />

<div class="dropdown {className}">
  {#if isDisabled}
    <div class="dropdown__trigger dropdown__trigger--static" aria-label={$_('dropdown.chooseEntity', { values: { entity } })}>
      {@render currentValue()}
    </div>
  {:else}
    <button
      type="button"
      class="dropdown__trigger"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={$_('dropdown.chooseEntity', { values: { entity } })}
      onclick={() => (open = !open)}
    >
      {@render currentValue()}
      {#if !hideChevron}
        <svg class="dropdown__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      {/if}
    </button>

    {#if open}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="dropdown__overlay" onclick={() => (open = false)} onkeydown={() => {}}></div>
      <div class="dropdown__panel" class:align-start={align === 'start'} role="listbox">
        {#if filterable}
          <input
            class="dropdown__filter"
            type="text"
            placeholder={$_('dropdown.searchPlaceholder', { values: { entity } })}
            bind:value={filter}
            autofocus
          />
        {/if}
        {#if filteredOptions.length === 0}
          <div class="dropdown__empty">{$_('dropdown.noOptions')}</div>
        {:else}
          <ul class="dropdown__list" class:dropdown__list--filterable={filterable}>
            {#each filteredOptions as option (option.value)}
              <li>
                <Button
                  variant="ghost"
                  class="dropdown__option {isSelected(option) ? 'dropdown__option--selected' : ''}"
                  onclick={() => select(option)}
                  aria-selected={isSelected(option)}
                  role="option"
                >
                  {@render renderOption(option)}
                </Button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  @reference "tailwindcss";
  .dropdown {
    @apply relative flex;
  }

  .dropdown__trigger {
    @apply flex items-center gap-1 cursor-pointer p-0 min-w-0 flex-1;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
  }

  .dropdown__trigger--static {
    @apply truncate;
  }

  .dropdown__chevron {
    @apply w-4 h-4 shrink-0;
  }

  .dropdown__overlay {
    @apply fixed inset-0 z-40;
  }

  .dropdown__panel {
    @apply absolute z-50 p-2;
    top: calc(100% + 4px);
    right: 0;
    min-width: 12rem;
    max-width: 15rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
  }

  .dropdown__panel.align-start {
    right: auto;
    left: 0;
  }

  .dropdown__filter {
    @apply w-full px-2 py-1 text-sm mb-2;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    color: var(--color-text);
  }
  .dropdown__filter:focus {
    outline: 2px solid var(--color-accent);
  }

  .dropdown__empty {
    @apply p-2 text-sm;
    color: var(--color-text-muted);
  }

  .dropdown__list {
    @apply list-none m-0 p-0 flex flex-col overflow-y-auto;
    gap: 2px;
    max-height: 20rem;
  }
  .dropdown__list--filterable {
    max-height: 18rem;
  }

  .dropdown__option {
    width: 100% !important;
    justify-content: flex-start !important;
    font-weight: normal !important;
  }

  :global(.dropdown__option--selected) {
    background: var(--color-surface-alt) !important;
  }
</style>
