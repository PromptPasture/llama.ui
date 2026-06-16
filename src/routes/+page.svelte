<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { goto } from '$app/navigation';
  import IndexedDB from '$lib/database/indexedDB';
  import { app } from '$lib/state/app.svelte';
  import { chat } from '$lib/state/chat.svelte';
  import { inference } from '$lib/state/inference.svelte';
  import { toast } from '$lib/components/toast.js';
  import { getUniqueRandomElements } from '$lib/utils/array-helpers';
  import type { MessageExtra } from '$lib/types';
  import ChatInput from './chat/[convId]/ChatInput.svelte';

  const SAMPLE_COUNT = 4;

  function getSamplePrompts(): string[] {
    try {
      const raw = $_('samplePrompts', { default: '[]' });
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  const samplePrompts = $derived(getUniqueRandomElements(getSamplePrompts(), SAMPLE_COUNT));

  async function handleSend(content: string, extra: MessageExtra[] | undefined): Promise<boolean | void> {
    const conv = await IndexedDB.createConversation(content.substring(0, 256));
    await goto(`/chat/${conv.id}`);
    return chat.sendMessage(
      {
        convId: conv.id,
        type: 'text',
        role: 'user',
        parent: conv.currNode,
        content,
        extra: extra ?? [],
        system: app.config.systemMessage,
        onChunk: () => {},
      },
      {
        config: app.config,
        provider: inference.provider,
        selectedModel: inference.selectedModel,
        navigate: (path) => goto(path),
        toast: toast.error,
      }
    );
  }
</script>

<svelte:head>
  <title>llama.ui — New Chat</title>
  <meta name="description" content="Start a new AI conversation" />
</svelte:head>

<div class="welcome">
  <div class="welcome__hero">
    <h1 class="welcome__title">{$_('welcomeScreen.welcome')}</h1>
    <p class="welcome__subtitle">{$_('welcomeScreen.welcomeNote')}</p>

    {#if samplePrompts.length > 0}
      <div class="welcome__prompts">
        {#each samplePrompts as prompt}
          <button
            type="button"
            class="welcome__prompt-btn"
            onclick={() => goto(`/chat?q=${encodeURIComponent(prompt)}`)}
          >
            {prompt}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <ChatInput onsend={handleSend} />
</div>

<style>
  .welcome {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 56rem;
    margin: 0 auto;
    width: 100%;
  }

  .welcome__hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .welcome__title { font-size: 2.25rem; font-weight: 500; margin: 0; }
  .welcome__subtitle { margin: 0.5rem 0 0; color: var(--color-text-muted); font-size: 0.875rem; }

  .welcome__prompts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-top: 2rem;
    max-width: 36rem;
  }

  @media (min-width: 640px) { .welcome__prompts { grid-template-columns: repeat(4, 1fr); } }

  .welcome__prompt-btn {
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 0.5rem;
    cursor: pointer;
    color: var(--color-text);
    font-size: 0.8125rem;
    font-weight: 500;
    text-align: center;
    line-height: 1.4;
    transition: background 0.15s;
  }
  .welcome__prompt-btn:hover { background: var(--color-border); }
</style>
