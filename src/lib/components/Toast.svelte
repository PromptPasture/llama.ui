<script lang="ts">
  import { toastStore } from './toast.js';
</script>

<div class="toast-host" role="status" aria-live="polite" aria-atomic="false">
  {#each $toastStore as item (item.id)}
    <div
      class="toast"
      class:toast--success={item.level === 'success'}
      class:toast--error={item.level === 'error'}
    >
      {item.message}
    </div>
  {/each}
</div>

<style>
  @reference "tailwindcss";
  .toast-host {
    @apply fixed bottom-6 right-6 flex flex-col gap-2 pointer-events-none;
    z-index: 9999;
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
