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

<div class="dropdown {className}" class:dropdown--open={open}>
  {#if isDisabled}
    <div class="dropdown__trigger truncate" aria-label={$_('dropdown.chooseEntity', { values: { entity } })}>
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
      <div class="dropdown__backdrop" onclick={() => (open = false)} onkeydown={() => {}}></div>
      <div class="dropdown__content dropdown__content--{align}" role="listbox">
        {#if filterable}
          <input
            class="dropdown__search"
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
  .dropdown { position: relative; display: flex; }
  .dropdown__trigger {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    padding: 0;
    min-width: 0;
    flex: 1;
  }
  .dropdown__chevron { width: 1rem; height: 1rem; flex-shrink: 0; }
  .dropdown__backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
  }
  .dropdown__content {
    position: absolute;
    top: calc(100% + 4px);
    z-index: 50;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: 0.5rem;
    min-width: 12rem;
    max-width: 15rem;
  }
  .dropdown__content--end { right: 0; }
  .dropdown__content--start { left: 0; }
  .dropdown__search {
    width: 100%;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }
  .dropdown__search:focus { outline: 2px solid var(--color-accent); }
  .dropdown__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; max-height: 20rem; }
  .dropdown__list--filterable { max-height: 18rem; }
  .dropdown__empty { padding: 0.5rem; font-size: 0.875rem; color: var(--color-text-muted); }
  :global(.dropdown__option) { width: 100% !important; justify-content: flex-start !important; font-weight: 400 !important; }
  :global(.dropdown__option--selected) { background: var(--color-surface-alt) !important; }
</style>
