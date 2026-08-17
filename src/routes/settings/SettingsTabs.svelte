<script lang="ts">
  import { _ } from 'svelte-i18n';

  interface SettingsTab {
    id: string;
    label: string;
    default: string;
  }

  interface Props {
    tabs: SettingsTab[];
    selected: string;
  }

  let { tabs, selected = $bindable() }: Props = $props();

  let tabRefs: HTMLButtonElement[] = [];

  /**
   * Which way an arrow key moves along the strip.
   *
   * Right and left mean the other thing when the layout is turned round: in
   * Arabic the first tab is the rightmost, so pressing Right moves towards it
   * rather than away. Up and down are unaffected — the order does not turn
   * over, only across.
   *
   * @param key - The key that was pressed
   * @returns 1 onwards, -1 back, 0 for a key that means neither
   */
  function step(key: string): number {
    const turnedRound = document.documentElement.dir === 'rtl';
    switch (key) {
      case 'ArrowDown':
        return 1;
      case 'ArrowUp':
        return -1;
      case 'ArrowRight':
        return turnedRound ? -1 : 1;
      case 'ArrowLeft':
        return turnedRound ? 1 : -1;
      default:
        return 0;
    }
  }

  // A tablist is expected to move between tabs with the arrow keys, with only
  // the selected tab in the tab order (roving tabindex).
  function onTabKeydown(event: KeyboardEvent, index: number) {
    let next: number;
    const moved = step(event.key);
    if (moved !== 0) {
      next = (index + moved + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = tabs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    selected = tabs[next].id;
    tabRefs[next]?.focus();
  }
</script>

<div
  class="settings__tabs"
  role="tablist"
  aria-label={$_('settings.ariaLabels.tabs')}
>
  {#each tabs as tab, i (tab.id)}
    <button
      bind:this={tabRefs[i]}
      type="button"
      role="tab"
      id="settings-tab-{tab.id}"
      class="settings__tab"
      class:active={selected === tab.id}
      aria-selected={selected === tab.id}
      aria-controls="settings-panel-{tab.id}"
      tabindex={selected === tab.id ? 0 : -1}
      onclick={() => (selected = tab.id)}
      onkeydown={(e) => onTabKeydown(e, i)}
    >
      {$_(tab.label, { default: tab.default })}
    </button>
  {/each}
</div>

<style>
  @reference "tailwindcss";
  .settings__tabs {
    @apply flex flex-row overflow-x-auto gap-1 p-2;
    border-bottom: 1px solid var(--color-border);
  }

  @media (min-width: 768px) {
    .settings__tabs {
      @apply flex-col overflow-x-hidden p-4 px-2;
      border-bottom: none;
      border-inline-end: 1px solid var(--color-border);
    }
  }

  .settings__tab {
    @apply px-3 py-1.5 text-sm text-start whitespace-nowrap shrink-0 cursor-pointer transition-[background] duration-150;
    background: transparent;
    border: none;
    color: var(--color-text);
    border-radius: var(--radius-md);
  }
  .settings__tab:hover {
    background: var(--color-surface-alt);
  }
  .settings__tab.active {
    background: var(--color-surface-alt);
    @apply font-semibold;
  }
</style>
