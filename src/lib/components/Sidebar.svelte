<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import SearchIcon from 'lucide-svelte/icons/search';
  import SquarePenIcon from 'lucide-svelte/icons/square-pen';
  import XIcon from 'lucide-svelte/icons/x';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import IndexedDB from '$lib/database/indexedDB';
  import { groupConversationsByDate } from '$lib/utils/conversation-grouper';
  import type { Conversation, ConversationMatch } from '$lib/types';
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

  let matches = $state<ConversationMatch[]>([]);

  /**
   * Searching reads every message, so it happens off to the side rather than
   * as the list is derived. Results can arrive out of order when one search
   * outruns another, so each is numbered and only the newest is kept.
   */
  let searchNo = 0;
  let answeredTerm = $state('');

  // Named so the effect below tracks both: the list matters as well as the
  // term, or a conversation renamed or deleted during a search would linger in
  // the results.
  const searchInputs = $derived({
    term: searchTerm.trim(),
    listSize: conversations.length,
  });

  /**
   * How long to wait before searching. Message content is not indexed, so a
   * search reads every message there is: measured at ~40ms over 1,800 of them,
   * on every keystroke, with the scans piling up on each other. Waiting for a
   * pause turns a search per letter into one per word.
   */
  const SEARCH_SETTLE_MS = 200;

  $effect(() => {
    const { term } = searchInputs;
    if (!term) {
      matches = [];
      return;
    }
    const mine = ++searchNo;
    const timer = setTimeout(() => {
      IndexedDB.searchConversations(term).then((found) => {
        if (mine !== searchNo) return;
        matches = found;
        // Which term the results answer. Without it, the moment before the
        // first search runs looks exactly like a search that found nothing.
        answeredTerm = term;
      });
    }, SEARCH_SETTLE_MS);
    // Typing on cancels the search that was about to run for what came before.
    return () => clearTimeout(timer);
  });

  const isFiltered = $derived(searchTerm.trim().length > 0);

  const groupedConv = $derived(
    // Month headings past the last thirty days are produced by the grouper
    // rather than translated from a key, so it needs the app's language.
    isFiltered ? [] : groupConversationsByDate(conversations, $locale ?? 'en')
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
    goto(resolve('/'));
    onclose?.();
  }
</script>

{#if open}
  <div
    class="sidebar__backdrop"
    onclick={onclose}
    onkeydown={() => {}}
    aria-hidden="true"
  ></div>
{/if}

<nav
  class="sidebar"
  class:open
  aria-label={$_('sidebar.ariaLabel', { default: 'Conversations' })}
>
  <!-- Header row -->
  <div class="sidebar__header">
    <Button
      variant="ghost"
      size="icon-xl"
      class="xl:hidden"
      onclick={onclose}
      aria-label={$_('sidebar.buttons.closeSideBar')}
    >
      <XIcon size={20} />
    </Button>

    <span class="sidebar__app-name"
      >{import.meta.env.VITE_APP_NAME ?? 'llama.ui'}</span
    >

    <Button
      variant="ghost"
      size="icon-xl"
      onclick={handleNewChat}
      title={$_('header.buttons.newConv')}
      aria-label={$_('header.ariaLabels.newConv')}
    >
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
      onkeydown={(e) => {
        if (e.key === 'Escape') searchTerm = '';
      }}
    />
    {#if isFiltered}
      <Button
        variant="ghost"
        size="icon-md"
        onclick={() => (searchTerm = '')}
        aria-label={$_('sidebar.ariaLabels.clear')}
      >
        <XIcon size={14} />
      </Button>
    {/if}
  </div>

  <!-- Conversation list -->
  <div class="sidebar__list">
    {#if !isFiltered}
      {#each groupedConv as group, idx (group.title)}
        <ConversationGroup
          {group}
          {currentConvId}
          class={idx > 0 ? 'mt-6' : 'mt-3'}
          onitemselect={handleItemSelect}
        />
      {/each}
    {:else}
      {#if matches.length === 0 && answeredTerm === searchInputs.term}
        <p class="sidebar__no-results">{$_('sidebar.search.noResults')}</p>
      {/if}
      <ul class="sidebar__filtered-list">
        {#each matches as match (match.conv.id)}
          <ConversationItem
            conv={match.conv}
            excerpt={match.excerpt}
            searchTerm={searchInputs.term}
            {currentConvId}
            onselect={handleItemSelect}
          />
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Footer -->
  <div class="sidebar__footer">
    {$_('sidebar.storageNote', {
      default: 'All data stored locally in your browser.',
    })}
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
    @apply fixed top-0 start-0 bottom-0 flex flex-col p-2;
    @apply xl:sticky xl:top-0 xl:h-screen;
    width: var(--sidebar-width);
    background: var(--color-surface-alt);
    box-shadow: var(--shadow-sidebar);
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 250ms ease;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  @media (min-width: 1280px) {
    .sidebar {
      transform: none;
    }
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

  /* The class is handed to <SearchIcon>, so scoped styles do not reach it; the
     ancestor keeps this from applying beyond this component. */
  .sidebar__search :global(.sidebar__search-icon) {
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

  .sidebar__no-results {
    @apply text-sm text-center py-6 px-3;
    color: var(--color-text-muted);
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
