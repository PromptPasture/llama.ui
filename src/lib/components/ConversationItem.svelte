<script lang="ts">
  import { _ } from 'svelte-i18n';
  import CopyIcon from 'lucide-svelte/icons/copy';
  import DownloadIcon from 'lucide-svelte/icons/download';
  import EllipsisVerticalIcon from 'lucide-svelte/icons/ellipsis-vertical';
  import PencilIcon from 'lucide-svelte/icons/pencil';
  import TrashIcon from 'lucide-svelte/icons/trash';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import IndexedDB from '$lib/database/indexedDB';
  import { chat } from '$lib/state/chat.svelte';
  import { modal } from '$lib/state/modal.svelte';
  import { toast } from '$lib/components/toast.js';
  import { copyStr } from '$lib/utils/dom-helpers';
  import { toMarkdown } from '$lib/utils/conversation-markdown';
  import { downloadAsFile } from '$lib/utils/downloadAsFile';
  import { toFileName } from '$lib/utils/filename';
  import { splitAround } from '$lib/utils/excerpt';
  import type { Conversation } from '$lib/types';
  import Button from './Button.svelte';

  interface Props {
    conv: Conversation;
    currentConvId?: string;
    /** Why this conversation came up in a search, when it was not the name. */
    excerpt?: string;
    /** What was searched for, so it can be marked within the excerpt. */
    searchTerm?: string;
    onselect?: () => void;
  }

  let {
    conv,
    currentConvId,
    excerpt,
    searchTerm = '',
    onselect,
  }: Props = $props();

  const quoted = $derived(splitAround(excerpt ?? '', searchTerm));

  const isCurrent = $derived(currentConvId === conv.id);
  const isPending = $derived(chat.isGenerating(conv.id));

  let menuOpen = $state(false);
  let wrapEl: HTMLDivElement | undefined = $state();
  let dropdownEl: HTMLUListElement | undefined = $state();

  /** The button that opens the actions, so focus can be handed back to it. */
  const trigger = () =>
    wrapEl?.querySelector<HTMLButtonElement>(':scope > button');

  function closeMenu() {
    menuOpen = false;
    // Focus is inside the list that is about to disappear; without this it
    // falls back to the document and the keyboard loses its place entirely.
    trigger()?.focus();
  }

  function onMenuKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    // The layout closes the whole sidebar on Escape. Closing the list that is
    // actually open is the narrower action, and the one meant here.
    event.stopPropagation();
    closeMenu();
  }

  // Only on the way open, so tabbing between the actions is not undone.
  let wasOpen = false;
  $effect(() => {
    if (menuOpen && !wasOpen) dropdownEl?.querySelector('button')?.focus();
    wasOpen = menuOpen;
  });

  function handleSelect() {
    onselect?.();
    goto(resolve('/chat/[convId]', { convId: conv.id }));
  }

  async function handleRename() {
    menuOpen = false;
    if (isPending) {
      toast.error($_('sidebar.errors.renameOnGenerate'));
      return;
    }
    const newName = await modal.showPrompt(
      $_('sidebar.actions.newName'),
      conv.name
    );
    if (!newName?.trim()) return;

    try {
      // Not awaiting left a failed rename unreported: the old name stayed in
      // the list with nothing to say why.
      await IndexedDB.updateConversationName(conv.id, newName.trim());
    } catch (error) {
      console.error('Conversation rename failed:', error);
      toast.error($_('sidebar.errors.renameFailed'));
    }
  }

  async function handleCopy() {
    menuOpen = false;
    try {
      const all = await IndexedDB.getMessages(conv.id);
      // The branch on screen, rather than every version ever written: what is
      // copied should be the conversation as it reads.
      const shown = IndexedDB.filterByLeafNodeId(all, conv.currNode, false);
      const copied = await copyStr(
        toMarkdown(shown, {
          user: $_('chatScreen.labels.user'),
          assistant: $_('chatScreen.labels.assistant'),
        })
      );
      if (copied) {
        toast.success($_('chatScreen.titles.copied'));
      } else {
        toast.error($_('chatScreen.errors.copyFailed'));
      }
    } catch (error) {
      console.error('Conversation copy failed:', error);
      toast.error($_('sidebar.errors.downloadFailed'));
    }
  }

  async function handleDownload() {
    menuOpen = false;
    if (isPending) {
      toast.error($_('sidebar.errors.downloadOnGenerate'));
      return;
    }
    try {
      const data = await IndexedDB.exportDB(conv.id);
      // Named after the conversation rather than its id, which is a
      // timestamp: three downloads in a folder could not be told apart.
      downloadAsFile(
        [JSON.stringify(data, null, 2)],
        `${toFileName(conv.name, conv.id)}.json`
      );
    } catch (error) {
      // Without this the menu simply closed and no file ever arrived.
      console.error('Conversation download failed:', error);
      toast.error($_('sidebar.errors.downloadFailed'));
    }
  }

  async function handleDelete() {
    menuOpen = false;
    if (isPending) {
      toast.error($_('sidebar.errors.deleteOnGenerate'));
      return;
    }
    if (!(await modal.showConfirm($_('sidebar.actions.deleteConfirm')))) return;

    try {
      await IndexedDB.deleteConversation(conv.id);
    } catch (error) {
      // Reporting success before the delete had happened meant a failure
      // looked exactly like a success, with the conversation still listed.
      console.error('Conversation delete failed:', error);
      toast.error($_('sidebar.errors.deleteFailed'));
      return;
    }

    toast.success($_('sidebar.actions.deleteSuccess'));
    // Deleting some other conversation from the sidebar should not take the
    // reader out of the one they are reading.
    if (isCurrent) goto(resolve('/'));
  }
</script>

<!-- A plain list item: it holds two buttons, and a menuitem may hold none.
     These are conversations to open rather than commands to run, so the list
     is a list. -->
<li class="conv-item" class:active={isCurrent}>
  <button
    type="button"
    class="conv-item__btn"
    onclick={handleSelect}
    dir="auto"
    title={conv.name}
    aria-label={$_('sidebar.ariaLabels.select', {
      values: { name: conv.name },
    })}
  >
    <span class="conv-item__name">{conv.name}</span>
    {#if excerpt}
      <span class="conv-item__excerpt">
        {quoted.before}<mark class="conv-item__hit">{quoted.match}</mark
        >{quoted.after}
      </span>
    {/if}
  </button>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={wrapEl}
    class="conv-item__menu-wrap"
    onkeydown={onMenuKeydown}
  >
    <Button
      variant="ghost"
      size="icon"
      onclick={() => (menuOpen = !menuOpen)}
      aria-label={$_('sidebar.ariaLabels.more')}
      aria-expanded={menuOpen}
    >
      <EllipsisVerticalIcon size={16} />
    </Button>

    {#if menuOpen}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="conv-item__overlay"
        onclick={() => (menuOpen = false)}
        onkeydown={() => {}}
      ></div>
      <!-- A labelled list of buttons rather than an ARIA menu. A menu promises
           arrow-key navigation and typeahead; tabbing between buttons is what
           this actually offers, and a button is what each of these is. -->
      <ul
        bind:this={dropdownEl}
        class="conv-item__dropdown"
        aria-label={$_('sidebar.ariaLabels.dropdown')}
      >
        <li>
          <Button variant="menu-item" size="small" onclick={handleRename}
            ><PencilIcon size={14} />{$_('sidebar.buttons.rename')}</Button
          >
        </li>
        <li>
          <Button
            variant="menu-item"
            size="small"
            onclick={handleCopy}
            aria-label={$_('sidebar.ariaLabels.copy')}
            ><CopyIcon size={14} />{$_('chatScreen.titles.copy')}</Button
          >
        </li>
        <li>
          <Button variant="menu-item" size="small" onclick={handleDownload}
            ><DownloadIcon size={14} />{$_('sidebar.buttons.download')}</Button
          >
        </li>
        <li>
          <Button
            variant="menu-item"
            size="small"
            class="conv-item__delete-btn"
            onclick={handleDelete}
            ><TrashIcon size={14} />{$_('sidebar.buttons.delete')}</Button
          >
        </li>
      </ul>
    {/if}
  </div>
</li>

<style>
  @reference "tailwindcss";
  .conv-item {
    @apply flex items-center relative;
    border-radius: var(--radius-md);
    padding: 0 0.5rem;
    min-height: 2.25rem;
  }
  .conv-item:hover {
    background: var(--color-surface-alt);
  }
  .conv-item.active {
    background: var(--color-surface-alt);
  }

  .conv-item__name {
    @apply block overflow-hidden text-ellipsis whitespace-nowrap;
  }

  .conv-item__hit {
    @apply font-semibold;
    background: transparent;
    color: var(--color-accent);
  }

  /* One line: the fragment is already trimmed to the words around the match. */
  .conv-item__excerpt {
    @apply block overflow-hidden text-ellipsis whitespace-nowrap text-xs mt-0.5;
    color: var(--color-text-muted);
  }

  .conv-item__btn {
    @apply flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm p-0;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    font: inherit;
  }

  .conv-item__menu-wrap {
    @apply relative shrink-0;
  }

  .conv-item__overlay {
    @apply fixed inset-0 z-40;
  }

  .conv-item__dropdown {
    @apply absolute end-0 z-50 p-1 list-none m-0;
    top: calc(100% + 4px);
    min-width: 10rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
  }

  /* The class is handed to <Button>, so scoped styles do not reach it; the
     ancestor keeps this from applying beyond this component. */
  .conv-item__dropdown :global(.conv-item__delete-btn) {
    color: var(--color-danger);
  }
</style>
