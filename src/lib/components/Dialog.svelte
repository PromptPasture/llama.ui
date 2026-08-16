<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title: string;
    onclose?: () => void;
    children: Snippet;
    actions?: Snippet;
  }

  let { open, title, onclose, children, actions }: Props = $props();

  let dialogEl: HTMLDialogElement;

  $effect(() => {
    if (!dialogEl) return;
    if (open) dialogEl.showModal();
    else dialogEl.close();
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose?.();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialogEl}
  class="dialog"
  aria-labelledby="dialog-title"
  {onkeydown}
  {onclose}
>
  <div class="dialog__body">
    <h3 id="dialog-title" class="dialog__title">{title}</h3>
    <div class="dialog__content">
      {@render children()}
    </div>
    {#if actions}
      <div class="dialog__actions">
        {@render actions()}
      </div>
    {/if}
  </div>
</dialog>

<style>
  @reference "tailwindcss";
  .dialog {
    @apply p-0;
    max-width: 28rem;
    width: calc(100vw - 2rem);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-lg);
  }

  .dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
  }

  .dialog__body {
    @apply p-6;
  }

  .dialog__title {
    @apply m-0 mb-4 text-lg font-semibold;
  }

  .dialog__content {
    @apply mb-4;
  }

  .dialog__actions {
    @apply flex justify-end gap-2;
  }
</style>
