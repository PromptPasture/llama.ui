<script lang="ts">
  import { _ } from 'svelte-i18n';
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
  import { downloadAsFile } from '$lib/utils/downloadAsFile';
  import type { Conversation } from '$lib/types';
  import Button from './Button.svelte';

  interface Props {
    conv: Conversation;
    currentConvId?: string;
    onselect?: () => void;
  }

  let { conv, currentConvId, onselect }: Props = $props();

  const isCurrent = $derived(currentConvId === conv.id);
  const isPending = $derived(chat.isGenerating(conv.id));

  let menuOpen = $state(false);

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
    if (newName?.trim())
      IndexedDB.updateConversationName(conv.id, newName.trim());
  }

  async function handleDownload() {
    menuOpen = false;
    if (isPending) {
      toast.error($_('sidebar.errors.downloadOnGenerate'));
      return;
    }
    const data = await IndexedDB.exportDB(conv.id);
    downloadAsFile(
      [JSON.stringify(data, null, 2)],
      `conversation_${conv.id}.json`
    );
  }

  async function handleDelete() {
    menuOpen = false;
    if (isPending) {
      toast.error($_('sidebar.errors.deleteOnGenerate'));
      return;
    }
    if (await modal.showConfirm($_('sidebar.actions.deleteConfirm'))) {
      toast.success($_('sidebar.actions.deleteSuccess'));
      await IndexedDB.deleteConversation(conv.id);
      goto(resolve('/'));
    }
  }
</script>

<li
  class="conv-item"
  class:active={isCurrent}
  role="menuitem"
  aria-label={conv.name}
>
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
    {conv.name}
  </button>

  <div class="conv-item__menu-wrap">
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
      <ul
        class="conv-item__dropdown"
        role="menu"
        aria-label={$_('sidebar.ariaLabels.dropdown')}
      >
        <li role="menuitem">
          <Button variant="menu-item" size="small" onclick={handleRename}
            ><PencilIcon size={14} />{$_('sidebar.buttons.rename')}</Button
          >
        </li>
        <li role="menuitem">
          <Button variant="menu-item" size="small" onclick={handleDownload}
            ><DownloadIcon size={14} />{$_('sidebar.buttons.download')}</Button
          >
        </li>
        <li role="menuitem">
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
    @apply absolute right-0 z-50 p-1 list-none m-0;
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
