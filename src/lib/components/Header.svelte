<script lang="ts">
  import { _ } from 'svelte-i18n';
  import CogIcon from 'lucide-svelte/icons/cog';
  import MenuIcon from 'lucide-svelte/icons/menu';
  import SquarePenIcon from 'lucide-svelte/icons/square-pen';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
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

<header class="header">
  <!-- Mobile row: sidebar toggle + title + new chat + settings -->
  <div class="header__mobile-row">
    <Button
      variant="ghost"
      size="icon-xl"
      onclick={onsidebartoggle}
      aria-label={$_('header.ariaLabels.openSidebar')}
    >
      <MenuIcon size={20} />
    </Button>

    <button
      type="button"
      class="header__title-btn"
      onclick={() => {
        if (showSettings) return;
        if (currConv) goto(resolve('/chat/[convId]', { convId: currConv.id }));
        else goto(resolve('/'));
      }}
      aria-label={title}
    >
      {title}
    </button>

    <Button
      variant="ghost"
      size="icon-xl"
      onclick={() => goto(resolve('/'))}
      title={$_('header.buttons.newConv')}
      aria-label={$_('header.ariaLabels.newConv')}
    >
      <SquarePenIcon size={20} />
    </Button>

    <!-- The desktop row is hidden below xl, so without this the settings page
         is unreachable on a narrow window: the only other route to it is the
         Ctrl+, shortcut, which a touch device has no way to send. -->
    {#if !showSettings}
      <Button
        variant="ghost"
        size="icon-xl"
        onclick={() => goto(resolve('/settings'))}
        title={$_('header.buttons.settings')}
        aria-label={$_('header.ariaLabels.settings')}
      >
        <CogIcon size={20} />
      </Button>
    {/if}
  </div>

  <!-- Desktop row (hidden on mobile): model selector + settings -->
  {#if !showSettings}
    <div class="header__desktop-row">
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
          <span class="header__model-name">{selectedModelName}</span>
        {/snippet}
        {#snippet renderOption(option)}
          <span class="truncate">{option.label}</span>
        {/snippet}
      </Dropdown>

      <div style="flex:1"></div>

      <Button
        variant="ghost"
        size="icon-xl"
        onclick={() => goto(resolve('/settings'))}
        title={$_('header.buttons.settings')}
        aria-label={$_('header.ariaLabels.settings')}
      >
        <CogIcon size={20} />
      </Button>
    </div>
  {:else}
    <div class="header__desktop-row header__desktop-row--settings">
      <span>{title}</span>
    </div>
  {/if}
</header>

<style>
  @reference "tailwindcss";
  .header {
    @apply flex flex-col gap-2 py-2 sticky top-0 z-10;
  }

  .header__mobile-row {
    @apply flex items-center gap-1 xl:hidden;
  }

  .header__title-btn {
    @apply flex-1 text-center overflow-hidden text-ellipsis whitespace-nowrap px-2;
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.01em;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
  }

  .header__desktop-row {
    @apply hidden xl:flex items-center gap-2 px-2;
  }

  .header__desktop-row--settings {
    @apply justify-center font-medium;
  }

  .header__model-name {
    @apply max-w-80 overflow-hidden text-ellipsis whitespace-nowrap font-semibold;
  }
</style>
