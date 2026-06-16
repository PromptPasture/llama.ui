<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { goto } from '$app/navigation';
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
    { id: 'conversations', label: 'settings.tabs.conversations', default: 'Conversations' },
    { id: 'presets', label: 'settings.tabs.presets', default: 'Presets' },
    { id: 'import-export', label: 'settings.tabs.importExport', default: 'Import / Export' },
    { id: 'advanced', label: 'settings.tabs.advanced', default: 'Advanced' },
    { id: 'experimental', label: 'settings.sections.experimental', default: 'Experimental' },
  ];

  let tabId = $state('general');
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
        if (!isString(val)) { await modal.showAlert(`Value for ${key} must be a string`); return; }
      } else if (isNumeric(def)) {
        const n = Number(String(val).trim());
        if (isNaN(n)) { await modal.showAlert(`Value for ${key} must be numeric`); return; }
        // @ts-expect-error safe cast
        cfg[k] = n;
      } else if (isBoolean(def)) {
        if (!isBoolean(val)) { await modal.showAlert(`Value for ${key} must be boolean`); return; }
      }
    }
    app.saveConfig(cfg);
    handleClose();
  }

  async function handleReset() {
    if (await modal.showConfirm('Are you sure you want to reset all settings?')) {
      localConfig = { ...CONFIG_DEFAULT } as Configuration;
    }
  }

  function handleClose() {
    const conv = inference.selectedModel; // just checking if we have context
    void conv;
    goto('/');
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

<div class="settings-page">
  <!-- Tab sidebar (desktop) / tab bar (mobile) -->
  <nav class="settings-tabs" role="tablist" aria-label="Settings sections">
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        role="tab"
        class="settings-tabs__btn"
        class:settings-tabs__btn--active={tabId === tab.id}
        aria-selected={tabId === tab.id}
        onclick={() => (tabId = tab.id)}
      >
        {$_(tab.label, { default: tab.default })}
      </button>
    {/each}
  </nav>

  <!-- Tab content -->
  <div class="settings-content">
    {#if tabId === 'general'}
      <GeneralTab config={localConfig} models={localModels} {onchange} onfetchmodels={fetchModels} />
    {:else if tabId === 'ui'}
      <UITab config={localConfig} {onchange} />
    {:else if tabId === 'voice'}
      <VoiceTab config={localConfig} {onchange} />
    {:else if tabId === 'conversations'}
      <ConversationsTab config={localConfig} {onchange} />
    {:else if tabId === 'presets'}
      <PresetsTab config={localConfig} presets={app.presets} onsavepreset={handleSavePreset} onremovepreset={handleRemovePreset} onsaveconfig={async (c) => { app.saveConfig(c); handleClose(); }} />
    {:else if tabId === 'import-export'}
      <ImportExportTab onclose={handleClose} />
    {:else if tabId === 'advanced'}
      <AdvancedTab config={localConfig} {onchange} />
    {:else if tabId === 'experimental'}
      <ExperimentalTab config={localConfig} {onchange} />
    {/if}

    <footer class="settings-footer">
      <p>v{import.meta.env.PACKAGE_VERSION ?? ''} · {$_('settings.footer.storageNote', { default: 'All data stored locally.' })}</p>
    </footer>
  </div>

  <!-- Action bar -->
  <div class="settings-actions">
    <Button variant="neutral" onclick={handleSave}>{$_('settings.actionButtons.saveBtnLabel')}</Button>
    <Button onclick={handleClose}>{$_('settings.actionButtons.cancelBtnLabel')}</Button>
    <Button variant="ghost" onclick={handleReset}>{$_('settings.actionButtons.resetBtnLabel')}</Button>
  </div>
</div>

<style>
  .settings-page {
    display: grid;
    grid-template-rows: 1fr auto;
    grid-template-columns: 1fr;
    height: 100%;
    overflow: hidden;
  }

  @media (min-width: 768px) {
    .settings-page {
      grid-template-columns: 11rem 1fr;
      grid-template-rows: 1fr auto;
    }
  }

  .settings-tabs {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    gap: 0.25rem;
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-border);
  }

  @media (min-width: 768px) {
    .settings-tabs {
      flex-direction: column;
      overflow-x: hidden;
      border-bottom: none;
      border-right: 1px solid var(--color-border);
      padding: 1rem 0.5rem;
    }
  }

  .settings-tabs__btn {
    background: none;
    border: none;
    border-radius: var(--radius-md);
    padding: 0.375rem 0.75rem;
    cursor: pointer;
    color: var(--color-text);
    font-size: 0.875rem;
    text-align: left;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s;
  }

  .settings-tabs__btn:hover { background: var(--color-surface-alt); }
  .settings-tabs__btn--active { background: var(--color-surface-alt); font-weight: 600; }

  .settings-content {
    overflow-y: auto;
    padding: 1rem 1.5rem;
    grid-column: 1;
    grid-row: 1;
  }

  @media (min-width: 768px) {
    .settings-content { grid-column: 2; }
  }

  .settings-footer {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-top: 2rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
  }

  .settings-actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg);
    justify-content: center;
    grid-column: 1 / -1;
  }
</style>
