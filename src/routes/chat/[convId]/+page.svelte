<script lang="ts">
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { app } from '$lib/state/app.svelte';
  import { chat } from '$lib/state/chat.svelte';
  import { inference } from '$lib/state/inference.svelte';
  import { toast } from '$lib/components/toast.js';
  import { getListMessageDisplay } from '$lib/utils/message-hierarchy';
  import type { Message, MessageExtra } from '$lib/types';
  import type { PageProps } from './$types';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';

  // Typed by the route, so convId is a string rather than string | undefined.
  let { params }: PageProps = $props();

  const convId = $derived(params.convId);

  let msgListEl: HTMLDivElement;
  let currNodeId = $state(-1);

  $effect(() => {
    const id = convId;
    if (!id) return;
    currNodeId = -1;
    chat.loadConversation(id);
    requestAnimationFrame(() => {
      msgListEl?.scrollTo({ top: msgListEl.scrollHeight, behavior: 'smooth' });
    });
    return () => chat.unloadConversation(id);
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

  // Auto-scroll when pending message updates
  $effect(() => {
    if (pendingMsg) {
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
    navigate: (path: string) => goto(path),
    toast: toast.error,
  });

  async function handleSend(
    content: string,
    extra: MessageExtra[] | undefined
  ): Promise<boolean | void> {
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
    currNodeId = msg.parent as number;
    chat.sendMessage(
      {
        convId,
        type: msg.type,
        role: msg.role,
        parent: msg.parent,
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
    chat.sendMessage(
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
    chat.replaceMessage({ msg, newContent: content, onChunk }, deps);
  }
</script>

<svelte:head>
  <title>{chat.viewingChat?.conv?.name ?? 'Chat'} — llama.ui</title>
</svelte:head>

<div class="chat-page">
  <div bind:this={msgListEl} class="chat-page__scroll">
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

  <ChatInput {convId} onsend={handleSend} />
</div>

<style>
  @reference "tailwindcss";
  .chat-page {
    @apply flex flex-col h-full;
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
