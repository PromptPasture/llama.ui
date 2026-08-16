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

  // A tablist is expected to move between tabs with the arrow keys, with only
  // the selected tab in the tab order (roving tabindex).
  function onTabKeydown(event: KeyboardEvent, index: number) {
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    selected = tabs[next].id;
    tabRefs[next]?.focus();
  }
</script>

<div class="settings__tabs" role="tablist" aria-label="Settings sections">
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
      border-right: 1px solid var(--color-border);
    }
  }

  .settings__tab {
    @apply px-3 py-1.5 text-sm text-left whitespace-nowrap shrink-0 cursor-pointer transition-[background] duration-150;
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
