<script lang="ts">
  import { toastStore } from './toast.js';
</script>

<div class="toast-container" role="status" aria-live="polite" aria-atomic="false">
  {#each $toastStore as item (item.id)}
    <div class="toast toast--{item.level}">
      {item.message}
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 9999;
    pointer-events: none;
  }
  .toast {
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    font-size: 0.875rem;
    box-shadow: var(--shadow-md);
    pointer-events: auto;
    max-width: 320px;
  }
  .toast--success { border-color: var(--color-success); }
  .toast--error { border-color: var(--color-danger); color: var(--color-danger); }
</style>
