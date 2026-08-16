<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { _ } from 'svelte-i18n';
  import ArrowUpIcon from 'lucide-svelte/icons/arrow-up';
  import SquareIcon from 'lucide-svelte/icons/square';
  import { chat } from '$lib/state/chat.svelte';
  import { readDraft, writeDraft } from '$lib/utils/drafts';
  import type { MessageExtra } from '$lib/types';

  interface Props {
    convId?: string;
    onsend: (
      content: string,
      extra: MessageExtra[] | undefined
    ) => Promise<boolean | void>;
  }

  let { convId, onsend }: Props = $props();

  // The conversation the box was opened for; untracked because a later one
  // arrives as a change of parameters, handled by the effect below.
  let shownConv = untrack(() => convId);
  let value = $state(readDraft(shownConv));
  let textareaEl: HTMLTextAreaElement;

  const isPending = $derived(convId ? chat.isGenerating(convId) : false);

  // Opening another conversation is a change of parameters, not a new page, so
  // without this the box would carry its contents across.
  $effect(() => {
    const id = convId;
    untrack(() => {
      if (id === shownConv) return;
      shownConv = id;
      value = readDraft(id);
      resize();
    });
  });

  function resize() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(textareaEl.scrollHeight + 2, 200) + 'px';
  }

  async function send() {
    // A reply is still arriving. Sending is refused further down anyway, and
    // clearing the box on the way would take the message with it.
    if (isPending) return;
    const msg = value.trim();
    if (!msg) return;
    value = '';
    writeDraft(convId, '');
    resize();
    const ok = await onsend(msg, undefined);
    if (ok === false) {
      value = msg;
      writeDraft(convId, msg);
    }
  }

  function onkeydown(e: KeyboardEvent) {
    // Enter also confirms a candidate while an input method is composing —
    // which is how Japanese, Korean and Chinese are typed at all. Sending on
    // that Enter would post the half-converted text and swallow the keystroke
    // the writer meant for the IME.
    //
    // 229 is the code a browser reports while an input method owns the key.
    // Some report it on the very Enter that accepts a conversion, with
    // isComposing already back to false, so the flag alone lets that one
    // through. The original checked both.
    const composing = e.isComposing || e.keyCode === 229;
    if (e.key === 'Enter' && !e.shiftKey && !composing) {
      e.preventDefault();
      send();
    }
  }

  function onInput() {
    resize();
    writeDraft(convId, value);
  }

  function stop() {
    if (convId) chat.stopGenerating(convId);
  }

  $effect(() => {
    resize();
  });

  onMount(() => {
    // Opening a conversation and having to click the box before typing is a
    // step the original did not ask for. Only on the wide layout: on a narrow
    // one this raises the on-screen keyboard over the conversation before the
    // reader has decided to write anything.
    if (window.matchMedia?.('(min-width: 1280px)').matches) {
      textareaEl?.focus();
    }
  });
</script>

<div class="chat-input">
  <div class="chat-input__box">
    <textarea
      bind:this={textareaEl}
      bind:value
      class="chat-input__textarea"
      aria-label={$_('chatInput.ariaLabels.chatInput', {
        default: 'Chat input',
      })}
      placeholder={$_('chatInput.placeholder', { default: 'Type a message…' })}
      rows={1}
      dir="auto"
      {onkeydown}
      oninput={onInput}></textarea>

    <div class="chat-input__actions">
      {#if isPending}
        <button
          type="button"
          class="chat-input__btn chat-input__btn--stop"
          onclick={stop}
          aria-label={$_('chatInput.ariaLabels.stop')}
        >
          <SquareIcon size={16} />
        </button>
      {:else}
        <button
          type="button"
          class="chat-input__btn chat-input__btn--send"
          onclick={send}
          aria-label={$_('chatInput.ariaLabels.send', { default: 'Send' })}
        >
          <ArrowUpIcon size={18} />
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  @reference "tailwindcss";
  .chat-input {
    @apply shrink-0 px-3 pb-4 pt-2 w-full mx-auto;
    max-width: 56rem;
  }

  .chat-input__box {
    @apply flex items-end gap-2 ps-3 pe-2 py-2;
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .chat-input__textarea {
    @apply flex-1 resize-none text-base leading-6 overflow-y-auto p-0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--color-text);
    font: inherit;
    min-height: 1.5rem;
    max-height: 12rem;
  }

  .chat-input__actions {
    @apply shrink-0;
  }

  .chat-input__btn {
    @apply flex items-center justify-center w-8 h-8 cursor-pointer transition-[background] duration-150;
    border-radius: var(--radius-full);
    border: none;
  }

  .chat-input__btn--stop {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .chat-input__btn--send {
    background: var(--color-accent);
    color: var(--color-accent-fg);
  }
  .chat-input__btn--send:hover {
    background: var(--color-accent-hover);
  }
</style>
