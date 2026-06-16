<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { CogIcon, MenuIcon, SquarePenIcon } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { app } from '$lib/state/app.svelte';
  import { inference } from '$lib/state/inference.svelte';
  import { chat } from '$lib/state/chat.svelte';
  import Button from './Button.svelte';
  import Dropdown from './Dropdown.svelte';

  interface Props {
    showSettings?: boolean;
    onsidebartoggle?: () => void;
  }

  let { showSettings = false, onsidebartoggle }: Props = $props();

  const models = $derived(inference.models);
  const config = $derived(app.config);
  const currConv = $derived(chat.viewingChat?.conv ?? null);

  const title = $derived(
    showSettings
      ? $_('header.title.settings')
      : currConv
        ? currConv.name
        : $_('header.title.noChat')
  );

  const selectedModelName = $derived(
    models.find((m) => m.id === config.model)?.name ?? config.model
  );
</script>

<header class="site-header">
  <!-- Mobile row: sidebar toggle + title + new chat -->
  <div class="site-header__mobile">
    <Button variant="ghost" size="icon-xl" onclick={onsidebartoggle}
      aria-label="Open sidebar">
      <MenuIcon size={20} />
    </Button>

    <button type="button" class="site-header__title" onclick={() => {
      if (showSettings) return;
      if (currConv) goto(`/chat/${currConv.id}`); else goto('/');
    }} aria-label={title}>
      {title}
    </button>

    <Button variant="ghost" size="icon-xl" onclick={() => goto('/')}
      title={$_('header.buttons.newConv')} aria-label={$_('header.ariaLabels.newConv')}>
      <SquarePenIcon size={20} />
    </Button>
  </div>

  <!-- Desktop row (hidden on mobile): model selector + settings -->
  {#if !showSettings}
    <div class="site-header__desktop">
      <Dropdown
        entity="Model"
        options={models.map((m) => ({ value: m.id, label: m.name }))}
        filterable={true}
        hideChevron={models.length < 2}
        align="start"
        isSelected={(o) => config.model === o.value}
        onSelect={(o) => app.saveConfig({ ...config, model: o.value })}
      >
        {#snippet currentValue()}
          <span class="site-header__model-name">{selectedModelName}</span>
        {/snippet}
        {#snippet renderOption(option)}
          <span class="truncate">{option.label}</span>
        {/snippet}
      </Dropdown>

      <div style="flex:1"></div>

      <Button variant="ghost" size="icon-xl" onclick={() => goto('/settings')}
        title={$_('header.buttons.settings')} aria-label={$_('header.ariaLabels.settings')}>
        <CogIcon size={20} />
      </Button>
    </div>
  {:else}
    <div class="site-header__desktop site-header__desktop--settings">
      <span>{title}</span>
    </div>
  {/if}
</header>

<style>
  .site-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0;
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }

  .site-header__mobile {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  @media (min-width: 1280px) {
    .site-header__mobile { display: none; }
  }

  .site-header__title {
    flex: 1;
    text-align: center;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    font: inherit;
    padding: 0 0.5rem;
  }

  .site-header__desktop {
    display: none;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.5rem;
  }

  @media (min-width: 1280px) {
    .site-header__desktop { display: flex; }
  }

  .site-header__desktop--settings { justify-content: center; font-weight: 500; }

  .site-header__model-name {
    max-width: 20rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
</style>
