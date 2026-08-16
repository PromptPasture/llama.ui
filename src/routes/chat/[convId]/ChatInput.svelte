<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { _ } from 'svelte-i18n';
  import ArrowUpIcon from 'lucide-svelte/icons/arrow-up';
  import SquareIcon from 'lucide-svelte/icons/square';
  import XIcon from 'lucide-svelte/icons/x';
  import FileTextIcon from 'lucide-svelte/icons/file-text';
  import PaperclipIcon from 'lucide-svelte/icons/paperclip';
  import { app } from '$lib/state/app.svelte';
  import { chat } from '$lib/state/chat.svelte';
  import { toast } from '$lib/components/toast';
  import { readDraft, writeDraft } from '$lib/utils/drafts';
  import { isLongPaste } from '$lib/utils/long-paste';
  import {
    describeSize,
    looksBinary,
    MAX_FILE_BYTES,
  } from '$lib/utils/text-file';
  import { isImageType, readAsDataUrl } from '$lib/utils/image-file';
  import {
    readAttachments,
    writeAttachments,
    type PendingAttachment,
  } from '$lib/utils/attachments';
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

  /**
   * What has been attached to the message being written.
   *
   * Held in memory rather than stored with the draft: an attachment is as long
   * as whatever was pasted, and filling the browser's storage quota would cost
   * the reader every other draft they have.
   *
   * Carries an id of its own because two attachments can share a name — the
   * same file picked twice — and keying the list by name crashes the render.
   */
  let attached = $state<PendingAttachment[]>(readAttachments(shownConv));

  /** Identifies every attachment. Carries on from whatever was already
   * waiting, so no two of them share a key. Only ever counts up. */
  let counter = untrack(() => highestId(attached));

  function highestId(items: PendingAttachment[]): number {
    return items.reduce((highest, a) => Math.max(highest, a.id), 0);
  }

  /** Assigns and remembers together, so no path can change one without the
   * other. */
  function setAttached(next: PendingAttachment[]) {
    attached = next;
    writeAttachments(convId, next);
  }

  /** Numbers pasted text, which has no name of its own to be known by. */
  let pasteCount = 0;

  let fileInputEl: HTMLInputElement;
  let draggingOver = $state(false);

  const isPending = $derived(convId ? chat.isGenerating(convId) : false);

  // Opening another conversation is a change of parameters, not a new page, so
  // without this the box would carry its contents across.
  $effect(() => {
    const id = convId;
    untrack(() => {
      if (id === shownConv) return;
      shownConv = id;
      value = readDraft(id);
      // Attachments belong to the message they were made for, so this picks
      // up whatever was left waiting in the conversation being opened.
      attached = readAttachments(id);
      counter = highestId(attached);
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
    // An attachment is a message in itself: pasting a log in answer to a
    // question that has already been asked leaves nothing to type.
    if (!msg && attached.length === 0) return;
    const sent = attached;
    value = '';
    setAttached([]);
    writeDraft(convId, '');
    resize();
    const ok = await onsend(
      msg,
      sent.length ? sent.map((a) => a.extra) : undefined
    );
    if (ok === false) {
      value = msg;
      setAttached(sent);
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
      // Reports its own failures through onsend and never rejects.
      void send();
    }
  }

  function onPaste(e: ClipboardEvent) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length > 0) {
      // A screenshot goes to the clipboard as a file, and pasting one is how
      // most people would expect to put a picture in a message.
      e.preventDefault();
      void attachFiles(files);
      return;
    }
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!isLongPaste(text, app.config.pasteLongTextToFileLen)) return;
    // Otherwise the box fills with thousands of lines and the writer has to
    // scroll inside it to find their own question.
    e.preventDefault();
    pasteCount += 1;
    attach({
      type: 'textFile',
      name: $_('chatInput.pastedText', { values: { index: pasteCount } }),
      content: text,
    });
  }

  function attach(extra: MessageExtra) {
    counter += 1;
    setAttached([...attached, { id: counter, extra }]);
  }

  function unattach(id: number) {
    setAttached(attached.filter((a) => a.id !== id));
  }

  /**
   * Reads files into the message as text.
   *
   * Anything binary is refused rather than decoded: as text it is pages of
   * replacement characters, which say nothing to a model and would be sent all
   * the same.
   */
  async function attachFiles(files: readonly File[]) {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(
          $_('fileUpload.errors.fileTooLarge', {
            values: { size: describeSize(MAX_FILE_BYTES) },
          })
        );
        continue;
      }
      try {
        if (isImageType(file.type)) {
          attach({
            type: 'imageFile',
            name: file.name,
            base64Url: await readAsDataUrl(file),
          });
          continue;
        }
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (looksBinary(bytes)) {
          toast.error($_('fileUpload.errors.fileIsBinary'));
          continue;
        }
        attach({
          type: 'textFile',
          name: file.name,
          content: new TextDecoder().decode(bytes),
        });
      } catch {
        // An unreadable file is not a broken box; say so and keep the rest.
        toast.error($_('fileUpload.errors.failedToReadFile'));
      }
    }
  }

  async function onFilesPicked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    await attachFiles([...(input.files ?? [])]);
    // Cleared so that picking the same file again is still a change.
    input.value = '';
  }

  function onDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return;
    // Without this the browser navigates away to the dropped file.
    e.preventDefault();
    draggingOver = true;
  }

  async function onDrop(e: DragEvent) {
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length === 0) return;
    e.preventDefault();
    draggingOver = false;
    await attachFiles(files);
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

<!-- Dropping onto the message area attaches the files. It carries no role
     because it is a convenience for a mouse: the attach button below does the
     same thing, and is what a reader is offered. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="chat-input"
  class:chat-input--dragging={draggingOver}
  ondragover={onDragOver}
  ondragleave={() => (draggingOver = false)}
  ondrop={onDrop}
>
  {#if attached.length > 0}
    <ul
      class="chat-input__attachments"
      aria-label={$_('chatScreen.attachments')}
    >
      {#each attached as item (item.id)}
        <li class="chat-input__attachment">
          {#if item.extra.type === 'imageFile'}
            <!-- Decorative: the name is spelled out alongside it, and a
                 reader hearing it twice learns nothing the second time. -->
            <img
              class="chat-input__thumbnail"
              src={item.extra.base64Url}
              alt=""
            />
          {:else}
            <FileTextIcon size={14} />
          {/if}
          <span class="chat-input__attachment-name">{item.extra.name}</span>
          <button
            type="button"
            class="chat-input__attachment-remove"
            onclick={() => unattach(item.id)}
            aria-label={$_('chatInput.ariaLabels.removeButton')}
          >
            <XIcon size={14} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}

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
      oninput={onInput}
      onpaste={onPaste}></textarea>

    <div class="chat-input__actions">
      <!-- The button is the control; this only opens the picker for it. Left
           out of the accessibility tree so the two are not announced as two
           separate ways to attach a file. -->
      <input
        bind:this={fileInputEl}
        type="file"
        multiple
        class="chat-input__file"
        tabindex="-1"
        aria-hidden="true"
        onchange={onFilesPicked}
      />
      <button
        type="button"
        class="chat-input__btn chat-input__btn--attach"
        onclick={() => fileInputEl?.click()}
        aria-label={$_('chatInput.ariaLabels.uploadFile')}
      >
        <PaperclipIcon size={18} />
      </button>

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

  .chat-input--dragging .chat-input__box {
    border-color: var(--color-accent);
  }

  .chat-input__file {
    @apply hidden;
  }

  .chat-input__attachments {
    @apply flex flex-wrap gap-2 list-none p-0 m-0 mb-2;
  }

  .chat-input__attachment {
    @apply flex items-center gap-1.5 max-w-full ps-2 pe-1 py-1 rounded-md text-sm;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .chat-input__thumbnail {
    @apply w-8 h-8 rounded object-cover shrink-0;
  }

  .chat-input__attachment-name {
    @apply truncate;
  }

  .chat-input__attachment-remove {
    @apply p-1 rounded cursor-pointer opacity-70;
    background: none;
    border: none;
    color: inherit;
  }

  .chat-input__attachment-remove:hover {
    @apply opacity-100;
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
