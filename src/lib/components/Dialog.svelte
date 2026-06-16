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
  onkeydown={onkeydown}
  onclose={onclose}
>
  <div class="dialog__box">
    <h3 id="dialog-title" class="dialog__title">{title}</h3>
    <div class="dialog__body">
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
  .dialog {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text);
    padding: 0;
    max-width: 28rem;
    width: calc(100vw - 2rem);
    box-shadow: var(--shadow-lg);
  }
  .dialog::backdrop { background: rgb(0 0 0 / 0.5); }
  .dialog__box { padding: 1.5rem; }
  .dialog__title { margin: 0 0 1rem; font-size: 1.125rem; font-weight: 600; }
  .dialog__body { margin-bottom: 1rem; }
  .dialog__actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
</style>
