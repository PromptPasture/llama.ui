<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { CONFIG_DEFAULT, INFERENCE_PROVIDERS } from '$lib/config';
  import { app } from '$lib/state/app.svelte';
  import { inference } from '$lib/state/inference.svelte';
  import { modal } from '$lib/state/modal.svelte';
  import { toast } from '$lib/components/toast.js';
  import Button from '$lib/components/Button.svelte';
  import type {
    Configuration,
    ConfigurationKey,
    InferenceApiModel,
    InferenceProvidersKey,
  } from '$lib/types';
  import { isBoolean, isNumeric, isString } from '$lib/utils/type-guards';
  import GeneralTab from './GeneralTab.svelte';
  import UITab from './UITab.svelte';
  import VoiceTab from './VoiceTab.svelte';
  import ConversationsTab from './ConversationsTab.svelte';
  import PresetsTab from './PresetsTab.svelte';
  import ImportExportTab from './ImportExportTab.svelte';
  import AdvancedTab from './AdvancedTab.svelte';
  import ExperimentalTab from './ExperimentalTab.svelte';

  const tabs = [
    { id: 'general', label: 'settings.tabs.general', default: 'General' },
    { id: 'ui', label: 'settings.tabs.ui', default: 'UI' },
    { id: 'voice', label: 'settings.tabs.voice', default: 'Voice' },
    {
      id: 'conversations',
      label: 'settings.tabs.conversations',
      default: 'Conversations',
    },
    { id: 'presets', label: 'settings.tabs.presets', default: 'Presets' },
    {
      id: 'import-export',
      label: 'settings.tabs.importExport',
      default: 'Import / Export',
    },
    { id: 'advanced', label: 'settings.tabs.advanced', default: 'Advanced' },
    {
      id: 'experimental',
      label: 'settings.sections.experimental',
      default: 'Experimental',
    },
  ];

  let tabId = $state('general');
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
    tabId = tabs[next].id;
    tabRefs[next]?.focus();
  }
  let localConfig = $state<Configuration>({ ...app.config });
  let localModels = $state<InferenceApiModel[]>([...inference.models]);

  function onchange(key: ConfigurationKey) {
    return (value: string | number | boolean) => {
      let next = { ...localConfig, [key]: value };
      if (key === 'provider') {
        const info = INFERENCE_PROVIDERS[value as InferenceProvidersKey];
        if (info?.baseUrl) next = { ...next, baseUrl: info.baseUrl };
      }
      localConfig = next;
      if (['provider', 'baseUrl', 'apiKey'].includes(key)) {
        debouncedFetch(next);
      }
    };
  }

  let _fetchTimer: ReturnType<typeof setTimeout>;
  function debouncedFetch(config: Configuration) {
    clearTimeout(_fetchTimer);
    _fetchTimer = setTimeout(async () => {
      const models = await inference.fetchModels(config, { silent: true });
      localModels = models;
    }, 1000);
  }

  async function fetchModels() {
    localModels = await inference.fetchModels(localConfig);
  }

  async function handleSave() {
    const cfg: Configuration = JSON.parse(JSON.stringify(localConfig));
    for (const key in cfg) {
      if (!(key in CONFIG_DEFAULT)) continue;
      const k = key as ConfigurationKey;
      const val = cfg[k];
      const def = CONFIG_DEFAULT[k];
      if (isString(def)) {
        if (!isString(val)) {
          await modal.showAlert(`Value for ${key} must be a string`);
          return;
        }
      } else if (isNumeric(def)) {
        const n = Number(String(val).trim());
        if (isNaN(n)) {
          await modal.showAlert(`Value for ${key} must be numeric`);
          return;
        }
        // @ts-expect-error safe cast
        cfg[k] = n;
      } else if (isBoolean(def)) {
        if (!isBoolean(val)) {
          await modal.showAlert(`Value for ${key} must be boolean`);
          return;
        }
      }
    }
    app.saveConfig(cfg);
    handleClose();
  }

  async function handleReset() {
    if (
      await modal.showConfirm('Are you sure you want to reset all settings?')
    ) {
      localConfig = { ...CONFIG_DEFAULT } as Configuration;
    }
  }

  function handleClose() {
    const conv = inference.selectedModel; // just checking if we have context
    void conv;
    goto(resolve('/'));
  }

  async function handleSavePreset(name: string, config: Configuration) {
    await app.savePreset(name, config, toast.success);
  }

  async function handleRemovePreset(name: string) {
    await app.removePreset(name, toast.success);
  }
</script>

<svelte:head>
  <title>Settings — llama.ui</title>
</svelte:head>

<div class="settings">
  <!-- Tab sidebar (desktop) / tab bar (mobile) -->
  <div class="settings__tabs" role="tablist" aria-label="Settings sections">
    {#each tabs as tab, i (tab.id)}
      <button
        bind:this={tabRefs[i]}
        type="button"
        role="tab"
        id="settings-tab-{tab.id}"
        class="settings__tab"
        class:active={tabId === tab.id}
        aria-selected={tabId === tab.id}
        aria-controls="settings-panel-{tab.id}"
        tabindex={tabId === tab.id ? 0 : -1}
        onclick={() => (tabId = tab.id)}
        onkeydown={(e) => onTabKeydown(e, i)}
      >
        {$_(tab.label, { default: tab.default })}
      </button>
    {/each}
  </div>

  <!-- Tab content -->
  <div
    class="settings__content"
    role="tabpanel"
    id="settings-panel-{tabId}"
    aria-labelledby="settings-tab-{tabId}"
  >
    {#if tabId === 'general'}
      <GeneralTab
        config={localConfig}
        models={localModels}
        {onchange}
        onfetchmodels={fetchModels}
      />
    {:else if tabId === 'ui'}
      <UITab config={localConfig} {onchange} />
    {:else if tabId === 'voice'}
      <VoiceTab config={localConfig} {onchange} />
    {:else if tabId === 'conversations'}
      <ConversationsTab config={localConfig} {onchange} />
    {:else if tabId === 'presets'}
      <PresetsTab
        config={localConfig}
        presets={app.presets}
        onsavepreset={handleSavePreset}
        onremovepreset={handleRemovePreset}
        onsaveconfig={async (c) => {
          app.saveConfig(c);
          handleClose();
        }}
      />
    {:else if tabId === 'import-export'}
      <ImportExportTab onclose={handleClose} />
    {:else if tabId === 'advanced'}
      <AdvancedTab config={localConfig} {onchange} />
    {:else if tabId === 'experimental'}
      <ExperimentalTab config={localConfig} {onchange} />
    {/if}

    <footer class="settings__footer">
      <p>
        v{import.meta.env.PACKAGE_VERSION ?? ''} · {$_(
          'settings.footer.storageNote',
          { default: 'All data stored locally.' }
        )}
      </p>
    </footer>
  </div>

  <!-- Action bar -->
  <div class="settings__actions">
    <Button variant="neutral" onclick={handleSave}
      >{$_('settings.actionButtons.saveBtnLabel')}</Button
    >
    <Button onclick={handleClose}
      >{$_('settings.actionButtons.cancelBtnLabel')}</Button
    >
    <Button variant="ghost" onclick={handleReset}
      >{$_('settings.actionButtons.resetBtnLabel')}</Button
    >
  </div>
</div>

<style>
  @reference "tailwindcss";
  .settings {
    @apply grid h-full overflow-hidden;
    grid-template-rows: 1fr auto;
    grid-template-columns: 1fr;
  }

  @media (min-width: 768px) {
    .settings {
      grid-template-columns: 11rem 1fr;
      grid-template-rows: 1fr auto;
    }
  }

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

  .settings__content {
    @apply overflow-y-auto px-6 py-4;
    grid-column-start: 1;
    grid-row-start: 1;
  }

  @media (min-width: 768px) {
    .settings__content {
      grid-column-start: 2;
    }
  }

  .settings__footer {
    @apply text-xs mt-8 pt-3;
    color: var(--color-text-muted);
    border-top: 1px solid var(--color-border);
  }

  .settings__actions {
    @apply flex gap-2 px-4 py-3 justify-center;
    grid-column: 1 / -1;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg);
  }
</style>
