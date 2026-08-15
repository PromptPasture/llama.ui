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
  <div class="sidebar__backdrop" onclick={onclose} onkeydown={() => {}} aria-hidden="true"></div>
{/if}

<nav
  class="sidebar"
  class:open
  aria-label={$_('sidebar.ariaLabel', { default: 'Conversations' })}
>
  <!-- Header row -->
  <div class="sidebar__header">
    <Button variant="ghost" size="icon-xl" class="xl:hidden" onclick={onclose}
      aria-label={$_('sidebar.buttons.closeSideBar')}>
      <XIcon size={20} />
    </Button>

    <span class="sidebar__app-name">{import.meta.env.VITE_APP_NAME ?? 'llama.ui'}</span>

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
  <div class="sidebar__list">
    {#if !isFiltered}
      {#each groupedConv as group, idx (group.title)}
        <ConversationGroup {group} {currentConvId} class={idx > 0 ? 'mt-6' : 'mt-3'} onitemselect={handleItemSelect} />
      {/each}
    {:else}
      <ul role="menu" class="sidebar__filtered-list">
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
  @reference "tailwindcss";
  .sidebar__backdrop {
    @apply fixed inset-0 xl:hidden;
    background: rgb(0 0 0 / 0.4);
    z-index: 49;
  }

  .sidebar {
    @apply fixed top-0 left-0 bottom-0 flex flex-col p-2;
    @apply xl:sticky xl:top-0 xl:h-screen;
    width: var(--sidebar-width);
    background: var(--color-surface-alt);
    box-shadow: var(--shadow-sidebar);
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 250ms ease;
  }

  .sidebar.open { transform: translateX(0); }

  @media (min-width: 1280px) {
    .sidebar { transform: none; }
  }

  .sidebar__header {
    @apply flex items-center justify-between px-1 pt-1 pb-2;
  }

  .sidebar__app-name {
    @apply font-bold text-base flex-1 text-center;
    letter-spacing: 0.05em;
  }

  .sidebar__search {
    @apply flex items-center gap-2 px-2 py-1 mb-2;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .sidebar__search-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .sidebar__search-input {
    @apply flex-1 text-sm;
    background: transparent;
    border: none;
    outline: none;
    color: var(--color-text);
  }

  .sidebar__list {
    @apply flex-1 min-h-0 overflow-y-auto px-1;
  }

  .sidebar__filtered-list {
    @apply list-none m-0 p-0;
  }

  .sidebar__footer {
    @apply text-xs text-center pt-4 mx-4;
    color: var(--color-text-muted);
  }
</style>
