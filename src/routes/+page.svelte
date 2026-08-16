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

  const samplePrompts = $derived(
    getUniqueRandomElements(getSamplePrompts(), SAMPLE_COUNT)
  );

  async function handleSend(
    content: string,
    extra: MessageExtra[] | undefined
  ): Promise<boolean | void> {
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
  @reference "tailwindcss";
  .welcome {
    @apply flex flex-col h-full w-full mx-auto;
    max-width: 56rem;
  }

  .welcome__hero {
    @apply flex-1 flex flex-col items-center justify-center p-4;
  }

  .welcome__title {
    @apply font-medium m-0;
    font-size: 2.25rem;
  }

  .welcome__subtitle {
    @apply mt-2 mb-0 text-sm;
    color: var(--color-text-muted);
  }

  .welcome__prompts {
    @apply grid grid-cols-2 sm:grid-cols-4 gap-2 mt-8;
    max-width: 36rem;
  }

  .welcome__prompt-btn {
    @apply p-2 cursor-pointer font-medium text-center leading-snug transition-[background] duration-150;
    font-size: 0.8125rem;
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    color: var(--color-text);
  }
  .welcome__prompt-btn:hover {
    background: var(--color-border);
  }
</style>
