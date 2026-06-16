<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { SearchIcon, SquarePenIcon, XIcon } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import IndexedDB from '$lib/database/indexedDB';
  import { groupConversationsByDate } from '$lib/utils/conversation-grouper';
  import type { Conversation } from '$lib/types';
  import Button from './Button.svelte';
  import ConversationGroup from './ConversationGroup.svelte';
  import ConversationItem from './ConversationItem.svelte';

  interface Props {
    open?: boolean;
    onclose?: () => void;
  }

  let { open = false, onclose }: Props = $props();

  let conversations = $state<Conversation[]>([]);
  let searchTerm = $state('');

  const currentConvId = $derived(page.params.convId as string | undefined);

  const filteredConversations = $derived(
    searchTerm.trim()
      ? conversations.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : []
  );

  const isFiltered = $derived(searchTerm.trim().length > 0);

  const groupedConv = $derived(
    isFiltered ? [] : groupConversationsByDate(conversations, 'en')
  );

  async function loadConversations() {
    conversations = await IndexedDB.getAllConversations();
  }

  function handleConversationChanged() {
    loadConversations();
  }

  $effect(() => {
    loadConversations();
    IndexedDB.onConversationChanged(handleConversationChanged);
    return () => IndexedDB.offConversationChanged(handleConversationChanged);
  });

  function handleItemSelect() {
    onclose?.();
  }

  function handleNewChat() {
    goto('/');
    onclose?.();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="sidebar-backdrop" onclick={onclose} onkeydown={() => {}} aria-hidden="true"></div>
{/if}

<nav
  class="sidebar"
  class:sidebar--open={open}
  aria-label={$_('sidebar.ariaLabel', { default: 'Conversations' })}
>
  <!-- Header row -->
  <div class="sidebar__header">
    <Button variant="ghost" size="icon-xl" class="sidebar__close xl-hidden" onclick={onclose}
      aria-label={$_('sidebar.buttons.closeSideBar')}>
      <XIcon size={20} />
    </Button>

    <span class="sidebar__brand">{import.meta.env.VITE_APP_NAME ?? 'llama.ui'}</span>

    <Button variant="ghost" size="icon-xl" onclick={handleNewChat}
      title={$_('header.buttons.newConv')} aria-label={$_('header.ariaLabels.newConv')}>
      <SquarePenIcon size={20} />
    </Button>
  </div>

  <!-- Search -->
  <div class="sidebar__search">
    <SearchIcon size={16} class="sidebar__search-icon" />
    <input
      type="text"
      class="sidebar__search-input"
      placeholder={$_('sidebar.searchPlaceHolder')}
      bind:value={searchTerm}
      onkeydown={(e) => { if (e.key === 'Escape') searchTerm = ''; }}
    />
    {#if isFiltered}
      <Button variant="ghost" size="icon-md" onclick={() => (searchTerm = '')}
        aria-label={$_('header.ariaLabels.clear')}>
        <XIcon size={14} />
      </Button>
    {/if}
  </div>

  <!-- Conversation list -->
  <div class="sidebar__list scroll-y">
    {#if !isFiltered}
      {#each groupedConv as group, idx (group.title)}
        <ConversationGroup {group} {currentConvId} class={idx > 0 ? 'mt-6' : 'mt-3'} onitemselect={handleItemSelect} />
      {/each}
    {:else}
      <ul role="menu" style="list-style:none;margin:0;padding:0">
        {#each filteredConversations as conv (conv.id)}
          <ConversationItem {conv} {currentConvId} onselect={handleItemSelect} />
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Footer -->
  <div class="sidebar__footer">
    {$_('sidebar.storageNote', { default: 'All data stored locally in your browser.' })}
  </div>
</nav>

<style>
  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    z-index: 49;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--sidebar-width);
    background: var(--color-bg-alt);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }

  @media (min-width: 1280px) {
    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      transform: none;
      border-right: 1px solid var(--color-border);
    }
    .sidebar-backdrop { display: none; }
    :global(.sidebar__close) { display: none !important; }
  }

  .sidebar--open { transform: translateX(0); }

  .sidebar__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.25rem 0.5rem;
  }

  .sidebar__brand {
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.05em;
    flex: 1;
    text-align: center;
  }

  .sidebar__search {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 0.25rem 0.5rem;
    margin-bottom: 0.5rem;
  }

  .sidebar__search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--color-text);
    font-size: 0.875rem;
  }

  .sidebar__list { flex: 1; min-height: 0; padding: 0 0.25rem; }

  .sidebar__footer {
    font-size: 0.75rem;
    text-align: center;
    color: var(--color-text-muted);
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
    margin-top: 0.5rem;
  }

  .mt-3 { margin-top: 0.75rem; }
  .mt-6 { margin-top: 1.5rem; }
</style>
