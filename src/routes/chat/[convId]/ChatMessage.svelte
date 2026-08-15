<script lang="ts">
  import { _ } from 'svelte-i18n';
  import {
    AtomIcon, BotIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon,
    CopyIcon, GitMergeIcon, RefreshCwIcon, SquarePenIcon, Trash2Icon,
  } from 'lucide-svelte';
  import { goto } from '$app/navigation';
  import IndexedDB from '$lib/database/indexedDB';
  import { app } from '$lib/state/app.svelte';
  import { chat } from '$lib/state/chat.svelte';
  import { inference } from '$lib/state/inference.svelte';
  import { modal } from '$lib/state/modal.svelte';
  import { toast } from '$lib/components/toast.js';
  import MarkdownDisplay from '$lib/components/MarkdownDisplay.svelte';
  import Button from '$lib/components/Button.svelte';
  import Textarea from '$lib/components/Textarea.svelte';
  import { copyStr } from '$lib/utils/dom-helpers';
  import { splitMessageContent } from '$lib/utils/message-parser';
  import { timeFormatter } from '$lib/utils/formatting';
  import type { Message, MessageDisplay, MessageExtra } from '$lib/types';

  interface Props {
    message: MessageDisplay;
    onregeneratefn: (msg: Message) => void;
    onedituserfn: (msg: Message, content: string, extra: MessageExtra[]) => void;
    oneditassistantfn: (msg: Message, content: string) => void;
    onchangesibling: (nodeId: Message['id']) => void;
  }

  let { message, onregeneratefn, onedituserfn, oneditassistantfn, onchangesibling }: Props = $props();

  const { msg, siblingCurrIdx, siblingLeafNodeIds, isPending } = $derived(message);
  const isUser = $derived(msg.role === 'user');
  const isAssistant = $derived(msg.role === 'assistant');
  const config = $derived(app.config);

  const { content, reasoning_content } = $derived.by(() => {
    if (msg.role !== 'assistant') return { content: msg.content };
    if (msg.reasoning_content) return { content: msg.content, reasoning_content: msg.reasoning_content };
    return splitMessageContent(msg.content);
  });

  const renderAsMarkdown = $derived(
    (isUser && !config.showRawUserMessage) ||
    (isAssistant && !config.showRawAssistantMessage) ||
    (!isUser && !isAssistant)
  );

  const prevSibling = $derived(siblingLeafNodeIds[siblingCurrIdx - 1]);
  const nextSibling = $derived(siblingLeafNodeIds[siblingCurrIdx + 1]);
  const isThinking = $derived(!!isPending && !content);

  let isEditing = $state(false);
  let editContent = $state('');
  let thinkingOpen = $state(config.showThoughtInProgress ?? true);

  const showActions = $derived(!isEditing && !isPending);

  function startEdit() {
    if (!msg.content) return;
    editContent = msg.content;
    isEditing = true;
  }

  function cancelEdit() { isEditing = false; }

  function submitUserEdit() {
    isEditing = false;
    onedituserfn(msg as Message, editContent, []);
  }

  function submitAssistantEdit() {
    isEditing = false;
    oneditassistantfn(msg as Message, editContent);
  }

  async function handleDelete() {
    if (await modal.showConfirm($_('chatScreen.actions.delete.confirm'))) {
      await IndexedDB.deleteMessage(msg as Message);
    }
  }

  async function handleBranch() {
    await chat.branchMessage(msg as Message, {
      navigate: (path) => goto(path),
      toast: toast.error,
    });
  }
</script>

<div class="msg mb-4" class:msg--user={isUser}
  role="group" aria-label={isUser ? $_('chatScreen.ariaLabels.messageUserRole') : $_('chatScreen.ariaLabels.messageAssistantRole')}>

  <!-- Bubble -->
  <div class="msg__bubble" class:msg__bubble--user={isUser} class:msg__bubble--assistant={isAssistant}>
    <!-- Metadata -->
    <div class="msg__meta">
      {#if isUser}
        <span class="msg__sender">{config.initials || $_('chatScreen.labels.user')}</span>
      {/if}
      {#if isAssistant && msg.model}
        <span class="msg__sender">{msg.model}</span>
      {/if}
      <span class="msg__timestamp">{timeFormatter.format(msg.timestamp)}</span>
    </div>

    <!-- Edit mode -->
    {#if isEditing}
      <Textarea value={editContent} oninput={(e) => (editContent = (e.target as HTMLTextAreaElement).value)} autoresize />
      <div class="msg__edit-actions">
        <Button variant="ghost" onclick={cancelEdit}>{$_('chatScreen.labels.cancel')}</Button>
        {#if isUser}
          <Button onclick={submitUserEdit} disabled={!editContent}>{$_('chatScreen.labels.send')}</Button>
        {:else}
          <Button onclick={submitAssistantEdit} disabled={!editContent}>{$_('chatScreen.labels.save')}</Button>
        {/if}
      </div>

    <!-- Content -->
    {:else if content || reasoning_content}
      <div dir="auto" tabindex="0">
        {#if reasoning_content}
          <div class="msg__reasoning">
            <button type="button" class="msg__reasoning-toggle" onclick={() => (thinkingOpen = !thinkingOpen)}>
              {#if isThinking}
                <AtomIcon size={16} class="animate-spin" />
                {$_('chatScreen.labels.thinking')}
              {:else}
                <BotIcon size={16} />
                {$_('chatScreen.labels.reasoning')}
              {/if}
              {#if thinkingOpen}<ChevronDownIcon size={14} />{:else}<ChevronRightIcon size={14} />{/if}
            </button>
            {#if thinkingOpen}
              <div class="msg__reasoning-body">
                {#if config.showRawAssistantMessage}
                  <pre>{reasoning_content}</pre>
                {:else}
                  <MarkdownDisplay content={reasoning_content} />
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        {#if content}
          {#if renderAsMarkdown}
            <MarkdownDisplay {content} streaming={!!isPending} />
          {:else}
            <div class="msg__raw">{content}</div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>

  <!-- Actions -->
  {#if msg.content !== null && showActions}
    <div class="msg__actions" class:msg__actions--user={isUser}>

      <!-- Sibling navigation -->
      {#if siblingLeafNodeIds && siblingLeafNodeIds.length > 1}
        <div class="msg__siblings" role="navigation">
          <Button variant="ghost" size="icon" onclick={() => prevSibling && onchangesibling(prevSibling)}
            disabled={!prevSibling} aria-label={$_('chatScreen.ariaLabels.switchToPrevious')}>
            <ChevronLeftIcon size={14} />
          </Button>
          <span>{siblingCurrIdx + 1} / {siblingLeafNodeIds.length}</span>
          <Button variant="ghost" size="icon" onclick={() => nextSibling && onchangesibling(nextSibling)}
            disabled={!nextSibling} aria-label={$_('chatScreen.ariaLabels.switchToNext')}>
            <ChevronRightIcon size={14} />
          </Button>
        </div>
      {/if}

      {#if isAssistant}
        <Button variant="ghost" size="icon" onclick={() => onregeneratefn(msg as Message)}
          disabled={!msg.content} aria-label={$_('chatScreen.ariaLabels.regenerateResponse')}>
          <RefreshCwIcon size={14} />
        </Button>
      {/if}

      <Button variant="ghost" size="icon" onclick={startEdit} disabled={!msg.content}
        aria-label={$_('chatScreen.ariaLabels.editMessage')}>
        <SquarePenIcon size={14} />
      </Button>

      <Button variant="ghost" size="icon" onclick={() => copyStr(msg.content ?? '')}
        aria-label={$_('chatScreen.ariaLabels.copyContent')}>
        <CopyIcon size={14} />
      </Button>

      <Button variant="ghost" size="icon" onclick={handleDelete} disabled={!msg.content}
        aria-label={$_('chatScreen.ariaLabels.deleteMessage')}>
        <Trash2Icon size={14} />
      </Button>

      <Button variant="ghost" size="icon" onclick={handleBranch} disabled={!msg.content}
        aria-label={$_('chatScreen.ariaLabels.branchChatAfterMessage')}>
        <GitMergeIcon size={14} />
      </Button>
    </div>
  {/if}
</div>

<style>
  @reference "tailwindcss";
  .msg {
    @apply mb-4;
  }

  .msg--user {
    @apply flex flex-col items-end;
  }

  .msg__bubble {
    @apply px-4 py-3;
    border-radius: var(--radius-lg);
  }

  .msg__bubble--user {
    @apply max-w-[85%];
    background: var(--color-surface-alt);
  }

  .msg__bubble--assistant {
    @apply max-w-full pl-0;
    background: transparent;
  }

  .msg__meta {
    @apply flex items-baseline gap-2 mb-1;
    font-size: 0.8125rem;
  }

  .msg__sender {
    @apply font-semibold;
  }

  .msg__timestamp {
    @apply text-xs;
    opacity: 0.4;
  }

  .msg__edit-actions {
    @apply flex gap-2 mt-2 justify-end;
  }

  .msg__reasoning {
    @apply mb-2;
  }

  .msg__reasoning-toggle {
    @apply inline-flex items-center gap-1.5 px-3 py-1 cursor-pointer mb-1;
    font-size: 0.8125rem;
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text);
  }

  .msg__reasoning-body {
    @apply pl-4 mb-3 text-sm;
    border-left: 2px solid var(--color-border);
    color: var(--color-text-muted);
  }

  .msg__raw {
    @apply whitespace-pre-wrap;
  }

  .msg__actions {
    @apply flex items-center gap-1 mt-1 flex-wrap;
  }

  .msg__actions--user {
    @apply flex-row-reverse;
  }

  .msg__siblings {
    @apply flex items-center gap-1 text-xs;
    opacity: 0.6;
  }
</style>
