<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { app } from '$lib/state/app.svelte';
  import { chat } from '$lib/state/chat.svelte';
  import { inference } from '$lib/state/inference.svelte';
  import { tts } from '$lib/state/tts.svelte';
  import { toast } from '$lib/components/toast.js';
  import { t } from '$lib/i18n/translate';
  import { offerToConfigure } from '$lib/first-run';
  import { isAtBottom } from '$lib/utils/dom-helpers';
  import { getListMessageDisplay } from '$lib/utils/message-hierarchy';
  import type { Message, MessageExtra } from '$lib/types';
  import type { PageProps } from './$types';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';
  import ChevronDownIcon from 'lucide-svelte/icons/chevron-down';
  import Button from '$lib/components/Button.svelte';

  // Typed by the route, so convId is a string rather than string | undefined.
  let { params }: PageProps = $props();

  const convId = $derived(params.convId);

  let msgListEl: HTMLDivElement;

  /**
   * Whether the reply should keep scrolling itself into view.
   *
   * Recorded when the reader scrolls rather than measured when a chunk lands:
   * by the time the effect runs, the new text is already in the list, so
   * someone who was at the bottom a moment ago now measures as being above it.
   */
  let following = $state(true);

  function jumpToLatest() {
    following = true;
    msgListEl?.scrollTo({ top: msgListEl.scrollHeight, behavior: 'smooth' });
  }

  function onListScroll() {
    if (msgListEl) following = isAtBottom(msgListEl);
  }

  let currNodeId = $state(-1);

  $effect(() => {
    const id = convId;
    if (!id) return;
    currNodeId = -1;
    chat
      .loadConversation(id)
      .then((found) => {
        // A deleted conversation or a stale link would otherwise render as an
        // empty chat that looks perfectly normal, until sending a message
        // failed.
        if (!found && id === convId) {
          toast.error(t('state.chat.errors.conversationNotFound'));
          void goto(resolve('/'));
        }
      })
      .catch((error: unknown) => {
        // Storage can be unavailable outright. Left unsaid, the conversation
        // appears to have gone — the same lie the sidebar takes care not to
        // tell.
        console.error('Reading the conversation failed:', error);
        toast.error(t('state.chat.errors.cannotReadConversation'));
      });
    following = true;
    requestAnimationFrame(() => {
      msgListEl?.scrollTo({ top: msgListEl.scrollHeight, behavior: 'smooth' });
    });
    return () => {
      chat.unloadConversation();
      // Speech outlives the page it came from otherwise, and keeps reading a
      // conversation the reader has already left.
      tts.stop();
    };
  });

  const displayMessages = $derived(
    chat.viewingChat?.messages
      ? getListMessageDisplay(chat.viewingChat.messages, currNodeId)
      : []
  );

  const lastMsgNodeId = $derived(displayMessages.at(-1)?.msg.id ?? -1);

  const pendingMsg = $derived.by(() => {
    const p = chat.pendingMessages[convId];
    if (!p || displayMessages.at(-1)?.msg.id === p.id) return null;
    return {
      msg: p,
      siblingLeafNodeIds: [],
      siblingCurrIdx: 0,
      isPending: true as const,
    };
  });

  // Follow the reply as it streams, unless the reader has scrolled away to
  // read something earlier — being dragged back on every chunk makes the rest
  // of the conversation unreadable until the reply ends.
  $effect(() => {
    if (pendingMsg && following) {
      requestAnimationFrame(() => {
        msgListEl?.scrollTo({ top: msgListEl.scrollHeight });
      });
    }
  });

  function onChunk(leafNodeId?: Message['id']) {
    if (leafNodeId) currNodeId = leafNodeId;
  }

  const deps = $derived({
    config: app.config,
    provider: inference.provider,
    selectedModel: inference.selectedModel,
    navigate: (id: string) => goto(resolve('/chat/[convId]', { convId: id })),
    toast: toast.error,
  });

  async function handleSend(
    content: string,
    extra: MessageExtra[] | undefined
  ): Promise<boolean | void> {
    // The same offer the welcome screen makes: there is nowhere to send this,
    // and the settings are where that is fixed.
    if (!inference.provider) {
      await offerToConfigure(app.config.baseUrl);
      return false;
    }
    // Sending is a request to be shown the answer, so it re-engages following
    // even if the reader had scrolled away to check something first.
    following = true;
    return chat.sendMessage(
      {
        convId,
        type: 'text',
        role: 'user',
        parent: lastMsgNodeId,
        content,
        extra: extra ?? [],
        system: app.config.systemMessage,
        onChunk,
      },
      deps
    );
  }

  function handleRegenerate(msg: Message) {
    // Asked of a reply, this replaces it: generation starts again from the
    // message it was answering. Asked of a message of the reader's own that
    // nothing answered, there is no reply to replace and the message itself
    // is what wants answering.
    const answering = msg.role === 'user' ? msg.id : (msg.parent as number);
    currNodeId = answering;
    // Reports its own failures and never rejects.
    void chat.sendMessage(
      {
        convId,
        type: msg.type,
        role: msg.role,
        parent: answering,
        content: null,
        extra: [],
        system: app.config.systemMessage,
        onChunk,
      },
      deps
    );
  }

  function handleEditUser(
    msg: Message,
    content: string,
    extra: MessageExtra[]
  ) {
    currNodeId = msg.id;
    // Reports its own failures and never rejects.
    void chat.sendMessage(
      {
        convId,
        type: msg.type,
        role: msg.role,
        parent: msg.parent,
        content,
        extra,
        system: app.config.systemMessage,
        onChunk,
      },
      deps
    );
  }

  function handleEditAssistant(msg: Message, content: string) {
    currNodeId = msg.id;
    void chat.replaceMessage({ msg, newContent: content, onChunk }, deps);
  }
</script>

<svelte:head>
  <title>{chat.viewingChat?.conv?.name ?? 'Chat'} — llama.ui</title>
</svelte:head>

<div class="chat-page">
  <div bind:this={msgListEl} class="chat-page__scroll" onscroll={onListScroll}>
    <div class="chat-page__messages">
      {#each displayMessages as message (message.msg.id)}
        <ChatMessage
          {message}
          onregeneratefn={handleRegenerate}
          onedituserfn={handleEditUser}
          oneditassistantfn={handleEditAssistant}
          onchangesibling={(id) => (currNodeId = id)}
        />
      {/each}

      {#if pendingMsg}
        <ChatMessage
          message={pendingMsg}
          onregeneratefn={() => {}}
          onedituserfn={() => {}}
          oneditassistantfn={() => {}}
          onchangesibling={() => {}}
        />
        <span class="chat-page__pending-indicator" aria-hidden="true">⋯</span>
      {/if}
    </div>
  </div>

  {#if !following}
    <!-- Scrolling up stops the reply pulling the view down, which leaves no
         way back to it but scrolling all the way there. -->
    <div class="chat-page__jump">
      <Button
        variant="neutral"
        size="icon-md"
        onclick={jumpToLatest}
        aria-label={$_('chatScreen.ariaLabels.jumpToLatest')}
      >
        <ChevronDownIcon size={18} />
      </Button>
    </div>
  {/if}

  <ChatInput {convId} onsend={handleSend} />
</div>

<style>
  @reference "tailwindcss";
  .chat-page {
    @apply flex flex-col h-full;
  }

  .chat-page__jump {
    @apply sticky bottom-0 flex justify-center pointer-events-none;
    height: 0;
  }

  .chat-page__jump :global(button) {
    @apply pointer-events-auto rounded-full shadow-md;
    transform: translateY(-0.5rem);
  }

  .chat-page__scroll {
    @apply flex-1 overflow-y-auto overflow-x-hidden px-3;
  }

  .chat-page__messages {
    @apply mx-auto py-4;
    max-width: 56rem;
  }

  .chat-page__pending-indicator {
    @apply block text-2xl mb-2;
    opacity: 0.5;
  }
</style>
