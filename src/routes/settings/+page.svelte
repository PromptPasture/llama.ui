<script lang="ts">
  import { onDestroy } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
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
  import { deepEqual } from '$lib/utils/object-helpers';
  import { isBoolean, isNumeric, isString } from '$lib/utils/type-guards';
  import SettingsTabs from './SettingsTabs.svelte';
  import GeneralTab from './GeneralTab.svelte';
  import UITab from './UITab.svelte';
  import VoiceTab from './VoiceTab.svelte';
  import ConversationsTab from './ConversationsTab.svelte';
  import PresetsTab from './PresetsTab.svelte';
  import ImportExportTab from './ImportExportTab.svelte';
  import AdvancedTab from './AdvancedTab.svelte';

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

  // Leaving the settings while a keystroke's fetch is still pending would
  // otherwise send it a second later, from a screen that is no longer there.
  onDestroy(() => clearTimeout(_fetchTimer));

  function debouncedFetch(config: Configuration) {
    clearTimeout(_fetchTimer);
    _fetchTimer = setTimeout(() => {
      // Silent: a failure at every keystroke is noise, and it answers an
      // empty list rather than rejecting.
      void inference.fetchModels(config, { silent: true }).then((models) => {
        localModels = models;
      });
    }, 1000);
  }

  /** Whether the models are being fetched right now. An unreachable server
   * takes about thirty seconds to say so. */
  let fetchingModels = $state(false);

  async function fetchModels() {
    fetchingModels = true;
    try {
      localModels = await inference.fetchModels(localConfig);
    } catch (error) {
      // The one button whose job is to find out whether the settings work.
      // It used to answer an empty list either way, leaving a wrong url, a
      // rejected key and a server that is down looking exactly alike.
      toast.error(
        $_('state.inference.errors.providerError', {
          values: { message: (error as Error).message },
        })
      );
    } finally {
      // Including after a failure: the one button whose job is to find out
      // what is wrong would otherwise be pressable exactly once.
      fetchingModels = false;
    }
  }

  async function handleSave() {
    const cfg: Configuration = JSON.parse(JSON.stringify(localConfig));
    for (const key in cfg) {
      if (!(key in CONFIG_DEFAULT)) continue;
      const k = key as ConfigurationKey;
      const val = cfg[k];
      const def = CONFIG_DEFAULT[k];
      // Named as the field is named on the screen, rather than by its key.
      const field = $_(`settings.parameters.${key}.label`, { default: key });
      if (isString(def)) {
        if (!isString(val)) {
          await modal.showAlert(
            $_('settings.validation.mustBeText', { values: { field } })
          );
          return;
        }
      } else if (isNumeric(def)) {
        const n = Number(String(val).trim());
        if (isNaN(n)) {
          await modal.showAlert(
            $_('settings.validation.mustBeNumber', { values: { field } })
          );
          return;
        }
        // @ts-expect-error safe cast
        cfg[k] = n;
      } else if (isBoolean(def)) {
        if (!isBoolean(val)) {
          await modal.showAlert(
            $_('settings.validation.mustBeTrueOrFalse', { values: { field } })
          );
          return;
        }
      }
    }
    // configToCustomOptions parses this per request and drops it on failure
    // with only a console message, so a typo here would silently stop every
    // custom option from being sent.
    if (cfg.custom.trim()) {
      try {
        JSON.parse(cfg.custom);
      } catch (error) {
        await modal.showAlert(
          $_('settings.validation.invalidCustomJson', {
            values: { message: (error as Error).message },
          })
        );
        return;
      }
    }

    app.saveConfig(cfg);
    leave();
  }

  async function handleReset() {
    if (await modal.showConfirm($_('settings.modals.resetConfirm'))) {
      localConfig = { ...CONFIG_DEFAULT } as Configuration;
    }
  }

  /**
   * Where saving or cancelling returns to. The conversation cannot be asked
   * for once we are here — leaving its route unloads it — so remember the page
   * we arrived from. Null when the settings were opened directly, by URL or
   * from the installed app's launcher.
   */
  let cameFrom = $state<string | null>(null);

  afterNavigate(({ from }) => {
    const path = from?.url.pathname ?? null;
    // Guard against the settings sending you back to themselves.
    cameFrom = path && path !== resolve('/settings') ? path : null;
  });

  /** Whether anything on these screens differs from what is stored. */
  const edited = $derived(!deepEqual(localConfig, app.config));

  const confirmDiscard = () =>
    modal.showConfirm($_('settings.modals.discardChanges'));

  /** Set while leaving on purpose, so the guard below stays out of the way. */
  let leaving = false;

  /** Leaves without asking — for the paths that have just saved something. */
  function leave() {
    leaving = true;
    // cameFrom is a pathname SvelteKit itself reported for a completed
    // navigation, so it already carries the base path that resolve() adds.
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    void goto(cameFrom ?? resolve('/'));
  }

  async function handleClose() {
    // Closing is one button away from Save and discards everything typed since
    // it was opened — a rewritten system prompt is a lot to lose to a misclick.
    if (edited && !(await confirmDiscard())) return;
    leave();
  }

  // Close is not the only way out: the sidebar, the browser's back gesture and
  // Ctrl+N all leave too, and each of them discarded the same work silently.
  beforeNavigate((nav) => {
    if (leaving || !edited) return;

    // Closing the tab, reloading, or following a link off the site. Only the
    // browser can ask about that, and only if the navigation is refused here.
    if (nav.type === 'leave') {
      nav.cancel();
      return;
    }

    const target = nav.to?.url;
    if (!target) return;

    // cancel() only counts while this callback is still running, so the
    // navigation has to be stopped first and restarted once the answer is in.
    nav.cancel();
    void confirmDiscard().then((discard) => {
      if (!discard) return;
      leaving = true;
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      void goto(target);
    });
  });

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
  <SettingsTabs {tabs} bind:selected={tabId} />

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
        {fetchingModels}
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
          leave();
        }}
      />
    {:else if tabId === 'import-export'}
      <ImportExportTab onclose={handleClose} />
    {:else if tabId === 'advanced'}
      <AdvancedTab config={localConfig} {onchange} />
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
