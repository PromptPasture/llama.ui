<script lang="ts">
  import { toastStore, type ToastItem } from './toast.js';

  // Errors go in an assertive region so a screen reader interrupts rather than
  // waiting for a pause: they report a failure the user needs to act on.
  const errors = $derived($toastStore.filter((t) => t.level === 'error'));
  const rest = $derived($toastStore.filter((t) => t.level !== 'error'));
</script>

{#snippet toastItem(item: ToastItem)}
  <div
    class="toast"
    class:toast--success={item.level === 'success'}
    class:toast--error={item.level === 'error'}
  >
    {item.message}
  </div>
{/snippet}

<div class="toast-host">
  <div
    class="toast-region"
    role="alert"
    aria-live="assertive"
    aria-atomic="false"
  >
    {#each errors as item (item.id)}
      {@render toastItem(item)}
    {/each}
  </div>
  <div
    class="toast-region"
    role="status"
    aria-live="polite"
    aria-atomic="false"
  >
    {#each rest as item (item.id)}
      {@render toastItem(item)}
    {/each}
  </div>
</div>

<style>
  @reference "tailwindcss";
  .toast-host {
    @apply fixed bottom-6 end-6 flex flex-col gap-2 pointer-events-none;
    z-index: 9999;
  }

  .toast-region {
    @apply flex flex-col gap-2;
  }

  .toast {
    @apply px-4 py-3 text-sm pointer-events-auto max-w-80;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    box-shadow: var(--shadow-md);
  }

  .toast--success {
    border-color: var(--color-success);
  }

  .toast--error {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }
</style>
