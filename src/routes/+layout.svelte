<script lang="ts">
  import { onMount } from 'svelte';
  import { locale } from 'svelte-i18n';
  import { goto } from '$app/navigation';
  import { app } from '$lib/state/app.svelte';
  import { inference } from '$lib/state/inference.svelte';
  import { initI18n } from '$lib/i18n/index.js';
  import Header from '$lib/components/Header.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import ModalHost from '$lib/components/ModalHost.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import '../app.css';

  let { children } = $props();

  let sidebarOpen = $state(false);
  let ready = $state(false);

  initI18n();

  onMount(async () => {
    await app.init();
    ready = true;
  });

  // Re-initialize inference when config changes
  $effect(() => {
    if (ready) inference.initialize(app.config);
  });

  // Global keyboard hotkeys
  function onKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'n') { e.preventDefault(); goto('/'); }
    else if (mod && e.key === ',') { e.preventDefault(); goto('/settings'); }
    else if (mod && e.key === 'k') { e.preventDefault(); sidebarOpen = true; }
    else if (e.key === 'Escape') sidebarOpen = false;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
  <meta name="theme-color" content="#EEEEEE" />
  <title>llama.ui</title>
</svelte:head>

<div class="app-shell">
  <Sidebar bind:open={sidebarOpen} onclose={() => (sidebarOpen = false)} />

  <div class="app-shell__content">
    <Header onsidebartoggle={() => (sidebarOpen = !sidebarOpen)} />
    <main class="app-shell__main">
      {#if ready}
        {@render children()}
      {/if}
    </main>
  </div>
</div>

<ModalHost />
<Toast />

<style>
  @reference "tailwindcss";
  :global(html), :global(body) { height: 100%; margin: 0; }

  .app-shell {
    @apply flex h-screen overflow-hidden;
  }

  .app-shell__content {
    @apply flex-1 min-w-0 flex flex-col overflow-hidden;
  }

  .app-shell__main {
    @apply flex-1 overflow-y-auto overflow-x-hidden;
  }
</style>
