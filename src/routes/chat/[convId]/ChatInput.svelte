<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { ArrowUpIcon, SquareIcon } from 'lucide-svelte';
  import { chat } from '$lib/state/chat.svelte';
  import type { MessageExtra } from '$lib/types';

  interface Props {
    convId?: string;
    onsend: (content: string, extra: MessageExtra[] | undefined) => Promise<boolean | void>;
  }

  let { convId, onsend }: Props = $props();

  let value = $state('');
  let textareaEl: HTMLTextAreaElement;

  const isPending = $derived(convId ? chat.isGenerating(convId) : false);

  function resize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight + 2, 200) + 'px';
  }

  async function send() {
    const msg = value.trim();
    if (!msg) return;
    value = '';
    resize();
    const ok = await onsend(msg, undefined);
    if (ok === false) value = msg;
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function stop() {
    if (convId) chat.stopGenerating(convId);
  }

  $effect(() => {
    resize();
  });
</script>

<div class="chat-input-wrap" aria-label={$_('chatInput.ariaLabels.chatInput', { default: 'Chat input' })}>
  <div class="chat-input">
    <textarea
      bind:this={textareaEl}
      bind:value
      class="chat-input__textarea"
      placeholder={$_('chatInput.placeholder', { default: 'Type a message…' })}
      rows={1}
      dir="auto"
      {onkeydown}
      oninput={resize}
      disabled={isPending}
    ></textarea>

    <div class="chat-input__actions">
      {#if isPending}
        <button type="button" class="chat-input__send chat-input__send--stop" onclick={stop}
          aria-label="Stop generation">
          <SquareIcon size={16} />
        </button>
      {:else}
        <button type="button" class="chat-input__send" onclick={send}
          aria-label={$_('chatInput.ariaLabels.send', { default: 'Send' })}>
          <ArrowUpIcon size={18} />
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .chat-input-wrap {
    flex-shrink: 0;
    padding: 0.5rem 0.75rem 1rem;
    width: 100%;
    max-width: 56rem;
    margin: 0 auto;
  }

  .chat-input {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 0.5rem 0.5rem 0.5rem 0.75rem;
    box-shadow: var(--shadow-sm);
  }

  .chat-input__textarea {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    resize: none;
    color: var(--color-text);
    font-family: inherit;
    font-size: 1rem;
    line-height: 1.5;
    min-height: 1.5rem;
    max-height: 12rem;
    overflow-y: auto;
    padding: 0;
  }

  .chat-input__actions { flex-shrink: 0; }

  .chat-input__send {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-full);
    background: var(--color-accent);
    color: var(--color-accent-fg);
    border: none;
    cursor: pointer;
    transition: background 0.15s;
  }

  .chat-input__send:hover { background: var(--color-accent-hover); }
  .chat-input__send--stop { background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); }
</style>
