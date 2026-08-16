<script lang="ts">
  import { onMount } from 'svelte';
  import { _, waitLocale } from 'svelte-i18n';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { app } from '$lib/state/app.svelte';
  import { inference } from '$lib/state/inference.svelte';
  import { initI18n } from '$lib/i18n/index.js';
  import { modal } from '$lib/state/modal.svelte';
  import { startServiceWorker } from '$lib/service-worker';
  import {
    offerToConfigure,
    SETUP_GRACE_MS,
    shouldOfferSetup,
  } from '$lib/first-run';
  import { page } from '$app/state';
  import { t } from '$lib/i18n/translate';
  import Header from '$lib/components/Header.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import ModalHost from '$lib/components/ModalHost.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import '../app.css';

  let { children } = $props();

  let sidebarOpen = $state(false);
  let ready = $state(false);
  /** Asked once a visit: declining should not be re-asked on every change. */
  let setupOffered = false;

  initI18n();

  onMount(async () => {
    await waitLocale();
    await app.init();
    ready = true;

    startServiceWorker(() =>
      modal.showConfirm(t('toast.newVersion.description'))
    );

    // Nothing can be answered until a provider is configured, and a first
    // visitor has no reason to know that. Offered after a pause, so a provider
    // that is simply slow to list its models is not mistaken for none.
    setTimeout(() => {
      if (
        !shouldOfferSetup({
          modelCount: inference.models.length,
          onSettingsScreen: page.url.pathname === resolve('/settings'),
          alreadyOffered: setupOffered,
        })
      ) {
        return;
      }
      setupOffered = true;
      void offerToConfigure(app.config.baseUrl);
    }, SETUP_GRACE_MS);
  });

  // Re-initialize inference when config changes
  $effect(() => {
    if (!ready) return;
    inference.initialize(app.config).then(() => {
      // Written back rather than only held in memory, so the picker in the
      // header agrees with what messages are actually being sent to.
      const adopt = inference.modelToAdopt(app.config);
      if (adopt) app.saveConfig({ ...app.config, model: adopt });
    });
  });

  // Global keyboard hotkeys
  function onKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'n') {
      e.preventDefault();
      goto(resolve('/'));
    } else if (mod && e.key === ',') {
      e.preventDefault();
      goto(resolve('/settings'));
    } else if (mod && e.key === 'k') {
      e.preventDefault();
      sidebarOpen = true;
    } else if (e.key === 'Escape') sidebarOpen = false;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
  <title>llama.ui</title>
</svelte:head>

{#if ready}
  <div class="app-shell">
    <Sidebar open={sidebarOpen} onclose={() => (sidebarOpen = false)} />

    <div class="app-shell__content">
      <Header onsidebartoggle={() => (sidebarOpen = !sidebarOpen)} />
      <main class="app-shell__main">
        {@render children()}
      </main>
      <footer class="app-shell__disclaimer">
        {$_('footer.disclaimer')}
      </footer>
    </div>
  </div>

  <ModalHost />
  <Toast />
{/if}

<style>
  @reference "tailwindcss";
  :global(html),
  :global(body) {
    height: 100%;
    margin: 0;
  }

  .app-shell {
    @apply flex h-screen overflow-hidden;
  }

  .app-shell__content {
    @apply flex-1 min-w-0 flex flex-col overflow-hidden px-1 pb-1 md:px-2 md:pb-2;
    background: var(--color-surface-alt);
  }

  .app-shell__disclaimer {
    @apply shrink-0 text-center text-xs pt-1 pb-1 md:pb-0;
    color: var(--color-text-muted);
  }

  .app-shell__main {
    @apply flex-1 overflow-y-auto overflow-x-hidden;
    background: var(--color-bg);
    border: 1px solid var(--color-border-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-inset);
  }
</style>
