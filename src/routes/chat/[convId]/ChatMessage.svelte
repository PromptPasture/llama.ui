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
  const showActions = $derived(!isEditing && !isPending);
  const isThinking = $derived(!!isPending && !content);

  let isEditing = $state(false);
  let editContent = $state('');
  let thinkingOpen = $state(config.showThoughtInProgress ?? true);

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

<div class="msg-wrap" class:msg-wrap--user={isUser} class:msg-wrap--assistant={isAssistant}
  role="group" aria-description={isUser ? $_('chatScreen.ariaLabels.messageUserRole') : $_('chatScreen.ariaLabels.messageAssistantRole')}>

  <!-- Extra attachments -->

  <!-- Bubble -->
  <div class="msg-bubble" class:msg-bubble--assistant={isAssistant}>
    <!-- Metadata -->
    <div class="msg-meta">
      {#if isUser}
        <span class="msg-meta__name">{config.initials || $_('chatScreen.labels.user')}</span>
      {/if}
      {#if isAssistant && msg.model}
        <span class="msg-meta__name">{msg.model}</span>
      {/if}
      <span class="msg-meta__time">{timeFormatter.format(msg.timestamp)}</span>
    </div>

    <!-- Edit mode -->
    {#if isEditing}
      <Textarea value={editContent} oninput={(e) => (editContent = (e.target as HTMLTextAreaElement).value)} autoresize />
      <div class="msg-edit-actions">
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
          <div class="thinking">
            <button type="button" class="thinking__toggle" onclick={() => (thinkingOpen = !thinkingOpen)}>
              {#if isThinking}
                <AtomIcon size={16} class="spin" />
                {$_('chatScreen.labels.thinking')}
              {:else}
                <BotIcon size={16} />
                {$_('chatScreen.labels.reasoning')}
              {/if}
              {#if thinkingOpen}<ChevronDownIcon size={14} />{:else}<ChevronRightIcon size={14} />{/if}
            </button>
            {#if thinkingOpen}
              <div class="thinking__content">
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
            <div class="whitespace-pre">{content}</div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>

  <!-- Actions -->
  {#if msg.content !== null && showActions}
    <div class="msg-actions" class:msg-actions--user={isUser}>

      <!-- Sibling navigation -->
      {#if siblingLeafNodeIds && siblingLeafNodeIds.length > 1}
        <div class="msg-siblings" role="navigation">
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
  .msg-wrap { margin-bottom: 1rem; }
  .msg-bubble {
    border-radius: var(--radius-lg);
    padding: 0.75rem 1rem;
    max-width: 85%;
    background: var(--color-surface-alt);
  }
  .msg-bubble--assistant { background: transparent; max-width: 100%; padding-left: 0; }
  .msg-wrap--user { display: flex; flex-direction: column; align-items: flex-end; }
  .msg-meta { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.25rem; font-size: 0.8125rem; }
  .msg-meta__name { font-weight: 600; }
  .msg-meta__time { font-size: 0.75rem; opacity: 0.4; }
  .msg-edit-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; justify-content: flex-end; }
  .msg-actions { display: flex; align-items: center; gap: 0.25rem; margin-top: 0.25rem; flex-wrap: wrap; }
  .msg-actions--user { flex-direction: row-reverse; }
  .msg-siblings { display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; opacity: 0.6; }
  .thinking { margin-bottom: 0.5rem; }
  .thinking__toggle {
    display: inline-flex; align-items: center; gap: 0.375rem;
    background: var(--color-surface-alt); border: 1px solid var(--color-border);
    border-radius: var(--radius-md); padding: 0.25rem 0.75rem; cursor: pointer;
    font-size: 0.8125rem; color: var(--color-text); margin-bottom: 0.25rem;
  }
  .thinking__content { border-left: 2px solid var(--color-border); padding-left: 1rem; margin-bottom: 0.75rem; font-size: 0.875rem; color: var(--color-text-muted); }
  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .whitespace-pre { white-space: pre-wrap; }
</style>
