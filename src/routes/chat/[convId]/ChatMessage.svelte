<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import AtomIcon from 'lucide-svelte/icons/atom';
  import BotIcon from 'lucide-svelte/icons/bot';
  import ChevronDownIcon from 'lucide-svelte/icons/chevron-down';
  import ChevronLeftIcon from 'lucide-svelte/icons/chevron-left';
  import ChevronRightIcon from 'lucide-svelte/icons/chevron-right';
  import CopyIcon from 'lucide-svelte/icons/copy';
  import GitMergeIcon from 'lucide-svelte/icons/git-merge';
  import RefreshCwIcon from 'lucide-svelte/icons/refresh-cw';
  import SquarePenIcon from 'lucide-svelte/icons/square-pen';
  import SquareIcon from 'lucide-svelte/icons/square';
  import Trash2Icon from 'lucide-svelte/icons/trash-2';
  import Volume2Icon from 'lucide-svelte/icons/volume-2';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import IndexedDB from '$lib/database/indexedDB';
  import { app } from '$lib/state/app.svelte';
  import { chat } from '$lib/state/chat.svelte';
  import { modal } from '$lib/state/modal.svelte';
  import { tts } from '$lib/state/tts.svelte';
  import { toast } from '$lib/components/toast.js';
  import MarkdownDisplay from '$lib/components/MarkdownDisplay.svelte';
  import Button from '$lib/components/Button.svelte';
  import Textarea from '$lib/components/Textarea.svelte';
  import { copyStr } from '$lib/utils/dom-helpers';
  import { splitMessageContent } from '$lib/utils/message-parser';
  import { speechText } from '$lib/utils/markdown';
  import { formatTime } from '$lib/utils/formatting';
  import { describeTimings } from '$lib/utils/timings';
  import type { Message, MessageDisplay, MessageExtra } from '$lib/types';

  interface Props {
    message: MessageDisplay;
    onregeneratefn: (msg: Message) => void;
    onedituserfn: (
      msg: Message,
      content: string,
      extra: MessageExtra[]
    ) => void;
    oneditassistantfn: (msg: Message, content: string) => void;
    onchangesibling: (nodeId: Message['id']) => void;
  }

  let {
    message,
    onregeneratefn,
    onedituserfn,
    oneditassistantfn,
    onchangesibling,
  }: Props = $props();

  const { msg, siblingCurrIdx, siblingLeafNodeIds, isPending } =
    $derived(message);
  const isUser = $derived(msg.role === 'user');

  /**
   * What was attached to the message.
   *
   * Audio is stored the same way but has nothing to show yet, and is left out
   * until there is something to play it with.
   */
  const attachments = $derived(
    (msg.extra ?? []).filter((e) => e.type !== 'audioFile')
  );
  const isAssistant = $derived(msg.role === 'assistant');
  const config = $derived(app.config);

  const { content, reasoning_content } = $derived.by(() => {
    if (msg.role !== 'assistant') return { content: msg.content };
    if (msg.reasoning_content)
      return { content: msg.content, reasoning_content: msg.reasoning_content };
    return splitMessageContent(msg.content);
  });

  // Collected from every reply and stored with it since before anything
  // showed it, which left the setting asking for it doing nothing.
  const performance = $derived(describeTimings(msg.timings));

  // Ties the toggle to what it opens. Message ids are unique across the store,
  // so this is too, however many messages are on screen.
  const reasoningId = $derived(`reasoning-${msg.id}`);

  let editEl: ReturnType<typeof Textarea> | undefined = $state();

  // Only on the way in, so a keystroke that re-renders does not send the
  // cursor back to the end of the text mid-edit.
  let wasEditing = false;
  $effect(() => {
    if (isEditing && !wasEditing) editEl?.focusEnd();
    wasEditing = isEditing;
  });

  function onEditKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      // The layout closes the sidebar on Escape as well; abandoning the edit
      // is the nearer action and the one meant here.
      event.stopPropagation();
      cancelEdit();
      return;
    }

    // Enter alone belongs to the text, which may run to several lines. Held
    // with a modifier it means "done", as it does in every other box that
    // takes more than one line.
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      if (!editContent) return;
      event.preventDefault();
      if (isUser) submitUserEdit();
      else submitAssistantEdit();
    }
  }

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
  // Deliberately seeded from config once: this tracks whether the user has
  // expanded the reasoning panel, so it must not follow config afterwards.
  // svelte-ignore state_referenced_locally
  let thinkingOpen = $state(config.showThoughtInProgress ?? true);

  const showActions = $derived(!isEditing && !isPending);

  function startEdit() {
    if (!msg.content) return;
    editContent = msg.content;
    isEditing = true;
  }

  function cancelEdit() {
    isEditing = false;
  }

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
      navigate: (id) => goto(resolve('/chat/[convId]', { convId: id })),
      toast: toast.error,
    });
  }
</script>

<div
  class="msg mb-4"
  class:msg--user={isUser}
  role="group"
  aria-label={isUser
    ? $_('chatScreen.ariaLabels.messageUserRole')
    : $_('chatScreen.ariaLabels.messageAssistantRole')}
>
  <!-- Bubble -->
  <div
    class="msg__bubble"
    class:msg__bubble--user={isUser}
    class:msg__bubble--assistant={isAssistant}
  >
    <!-- Metadata -->
    <div class="msg__meta">
      {#if isUser}
        <span class="msg__sender"
          >{config.initials || $_('chatScreen.labels.user')}</span
        >
      {/if}
      {#if isAssistant && msg.model}
        <span class="msg__sender">{msg.model}</span>
      {/if}
      <span class="msg__timestamp">{formatTime(msg.timestamp, $locale)}</span>
      {#if config.showTokensPerSecond && performance}
        <span class="msg__timings" title={$_('chatScreen.titles.performance')}
          >{performance}</span
        >
      {/if}
    </div>

    <!-- Edit mode -->
    {#if isEditing}
      <Textarea
        bind:this={editEl}
        value={editContent}
        oninput={(e) => (editContent = (e.target as HTMLTextAreaElement).value)}
        onkeydown={onEditKeydown}
        autoresize
      />
      <div class="msg__edit-actions">
        <Button variant="ghost" onclick={cancelEdit}
          >{$_('chatScreen.labels.cancel')}</Button
        >
        {#if isUser}
          <Button onclick={submitUserEdit} disabled={!editContent}
            >{$_('chatScreen.labels.send')}</Button
          >
        {:else}
          <Button onclick={submitAssistantEdit} disabled={!editContent}
            >{$_('chatScreen.labels.save')}</Button
          >
        {/if}
      </div>

      <!-- Content -->
    {:else if content || reasoning_content}
      <div dir="auto">
        {#if reasoning_content}
          <div class="msg__reasoning">
            <button
              type="button"
              class="msg__reasoning-toggle"
              onclick={() => (thinkingOpen = !thinkingOpen)}
              aria-expanded={thinkingOpen}
              aria-controls={reasoningId}
            >
              {#if isThinking}
                <AtomIcon size={16} class="animate-spin" />
                {$_('chatScreen.labels.thinking')}
              {:else}
                <BotIcon size={16} />
                {$_('chatScreen.labels.reasoning')}
              {/if}
              {#if thinkingOpen}<ChevronDownIcon
                  size={14}
                />{:else}<ChevronRightIcon size={14} class="rtl-flip" />{/if}
            </button>
            {#if thinkingOpen}
              <div
                id={reasoningId}
                class="msg__reasoning-body"
                role="region"
                aria-label={$_('chatScreen.ariaLabels.thoughtContent')}
              >
                {#if config.showRawAssistantMessage}
                  <pre>{reasoning_content}</pre>
                {:else}
                  <MarkdownDisplay content={reasoning_content} />
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        {#if attachments.length > 0}
          <!-- What was attached is part of what was asked: without it the
               question reads as though it were missing its subject. -->
          <ul
            class="msg__attachments"
            aria-label={$_('chatScreen.attachments')}
          >
            {#each attachments as item (item.name)}
              <li>
                {#if item.type === 'imageFile'}
                  <img
                    class="msg__attachment-image"
                    src={item.base64Url}
                    alt={item.name}
                  />
                {:else}
                  <details class="msg__attachment">
                    <summary class="msg__attachment-name">{item.name}</summary>
                    <pre class="msg__attachment-content">{item.content}</pre>
                  </details>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}

        {#if content}
          {#if renderAsMarkdown}
            <MarkdownDisplay {content} streaming={!!isPending} />
          {:else}
            <div class="msg__raw">{content}</div>
          {/if}
        {/if}
      </div>
    {:else if isPending}
      <!-- Nothing has arrived yet. A local server loading a model into memory
           can take half a minute, and the bubble showed a timestamp and
           nothing else for all of it. -->
      <div class="msg__waiting" role="status">
        <AtomIcon size={16} class="animate-spin" />
        {$_('chatScreen.labels.thinking')}
      </div>
    {/if}
  </div>

  <!-- Actions -->
  {#if msg.content !== null && showActions}
    <div class="msg__actions" class:msg__actions--user={isUser}>
      <!-- Sibling navigation -->
      {#if siblingLeafNodeIds && siblingLeafNodeIds.length > 1}
        <div
          class="msg__siblings"
          role="navigation"
          aria-label={$_('chatScreen.ariaLabels.siblingLeafs', {
            values: {
              current: siblingCurrIdx + 1,
              total: siblingLeafNodeIds.length,
            },
          })}
        >
          <Button
            variant="ghost"
            size="icon"
            onclick={() => prevSibling && onchangesibling(prevSibling)}
            disabled={!prevSibling}
            title={$_('chatScreen.titles.previous')}
            aria-label={$_('chatScreen.ariaLabels.switchToPrevious')}
          >
            <ChevronLeftIcon size={14} class="rtl-flip" />
          </Button>
          <span>{siblingCurrIdx + 1} / {siblingLeafNodeIds.length}</span>
          <Button
            variant="ghost"
            size="icon"
            onclick={() => nextSibling && onchangesibling(nextSibling)}
            disabled={!nextSibling}
            title={$_('chatScreen.titles.next')}
            aria-label={$_('chatScreen.ariaLabels.switchToNext')}
          >
            <ChevronRightIcon size={14} class="rtl-flip" />
          </Button>
        </div>
      {/if}

      {#if isAssistant && tts.supported}
        {@const speaking = tts.isSpeaking(msg.id)}
        <Button
          variant="ghost"
          size="icon"
          onclick={() =>
            speaking
              ? tts.stop()
              : tts.speak(msg.id, speechText(content ?? ''), app.config)}
          disabled={!content}
          title={speaking
            ? $_('chatScreen.titles.stop')
            : $_('chatScreen.titles.play')}
          aria-label={speaking
            ? $_('chatScreen.ariaLabels.stopMessage')
            : $_('chatScreen.ariaLabels.playMessage')}
        >
          {#if speaking}
            <SquareIcon size={14} />
          {:else}
            <Volume2Icon size={14} />
          {/if}
        </Button>
      {/if}

      {#if isAssistant}
        <Button
          variant="ghost"
          size="icon"
          onclick={() => onregeneratefn(msg as Message)}
          disabled={!msg.content}
          title={$_('chatScreen.titles.regenerate')}
          aria-label={$_('chatScreen.ariaLabels.regenerateResponse')}
        >
          <RefreshCwIcon size={14} />
        </Button>
      {/if}

      <Button
        variant="ghost"
        size="icon"
        onclick={startEdit}
        disabled={!msg.content}
        title={$_('chatScreen.titles.edit')}
        aria-label={$_('chatScreen.ariaLabels.editMessage')}
      >
        <SquarePenIcon size={14} />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onclick={() => copyStr(msg.content ?? '')}
        title={$_('chatScreen.titles.copy')}
        aria-label={$_('chatScreen.ariaLabels.copyContent')}
      >
        <CopyIcon size={14} />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onclick={handleDelete}
        disabled={!msg.content}
        title={$_('chatScreen.titles.delete')}
        aria-label={$_('chatScreen.ariaLabels.deleteMessage')}
      >
        <Trash2Icon size={14} />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onclick={handleBranch}
        disabled={!msg.content}
        title={$_('chatScreen.titles.branchChat')}
        aria-label={$_('chatScreen.ariaLabels.branchChatAfterMessage')}
      >
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
    @apply max-w-full ps-0;
    background: transparent;
  }

  .msg__meta {
    @apply flex items-baseline gap-2 mb-1;
    font-size: 0.8125rem;
  }

  .msg__sender {
    @apply font-semibold;
  }

  .msg__timings {
    @apply text-xs tabular-nums;
    color: var(--color-text-muted);
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
    @apply ps-4 mb-3 text-sm;
    border-left: 2px solid var(--color-border);
    color: var(--color-text-muted);
  }

  .msg__waiting {
    @apply flex items-center gap-2 text-sm;
    color: var(--color-text-muted);
  }

  .msg__attachments {
    @apply flex flex-col gap-1 list-none p-0 m-0 mb-2;
  }

  .msg__attachment {
    @apply rounded-md text-sm;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .msg__attachment-image {
    @apply rounded-md max-w-full;
    max-height: 20rem;
    border: 1px solid var(--color-border);
  }

  .msg__attachment-name {
    @apply px-2 py-1 cursor-pointer truncate;
  }

  .msg__attachment-content {
    @apply px-2 pb-2 m-0 overflow-x-auto whitespace-pre-wrap break-words;
    max-height: 20rem;
    overflow-y: auto;
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
