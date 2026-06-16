<script lang="ts">
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { app } from '$lib/state/app.svelte';
  import { chat } from '$lib/state/chat.svelte';
  import { inference } from '$lib/state/inference.svelte';
  import { toast } from '$lib/components/toast.js';
  import { getListMessageDisplay } from '$lib/utils/message-hierarchy';
  import type { Message, MessageExtra } from '$lib/types';
  import ChatMessage from './ChatMessage.svelte';
  import ChatInput from './ChatInput.svelte';

  const convId = $derived(page.params.convId);

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
    return { msg: p, siblingLeafNodeIds: [], siblingCurrIdx: 0, isPending: true as const };
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

  async function handleSend(content: string, extra: MessageExtra[] | undefined): Promise<boolean | void> {
    return chat.sendMessage(
      { convId, type: 'text', role: 'user', parent: lastMsgNodeId, content, extra: extra ?? [], system: app.config.systemMessage, onChunk },
      deps
    );
  }

  function handleRegenerate(msg: Message) {
    currNodeId = msg.parent as number;
    chat.sendMessage(
      { convId, type: msg.type, role: msg.role, parent: msg.parent, content: null, extra: [], system: app.config.systemMessage, onChunk },
      deps
    );
  }

  function handleEditUser(msg: Message, content: string, extra: MessageExtra[]) {
    currNodeId = msg.id;
    chat.sendMessage(
      { convId, type: msg.type, role: msg.role, parent: msg.parent, content, extra, system: app.config.systemMessage, onChunk },
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
  <div bind:this={msgListEl} class="chat-page__messages">
    <div class="chat-page__list">
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
        <span class="chat-page__loading" aria-hidden="true">⋯</span>
      {/if}
    </div>
  </div>

  <ChatInput {convId} onsend={handleSend} />
</div>

<style>
  .chat-page {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .chat-page__messages {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 0.75rem;
  }

  .chat-page__list {
    max-width: 56rem;
    margin: 0 auto;
    padding: 1rem 0;
  }

  .chat-page__loading {
    display: block;
    font-size: 1.5rem;
    opacity: 0.5;
    margin-bottom: 0.5rem;
  }
</style>
