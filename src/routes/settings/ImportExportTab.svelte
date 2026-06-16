<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { app } from '$lib/state/app.svelte';
  import { toast } from '$lib/components/toast.js';
  import { downloadAsFile } from '$lib/utils/downloadAsFile';
  import Button from '$lib/components/Button.svelte';

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  async function handleExport() {
    const data = await app.exportDB(undefined, { success: toast.success, error: toast.error });
    downloadAsFile([JSON.stringify(data, null, 2)], 'llama-ui-database.json');
  }

  async function handleImport(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length !== 1) return;
    const text = await files[0].text();
    await app.importDB(text, { success: toast.success, error: toast.error });
    onclose();
  }
</script>

<section>
  <h4>{$_('settings.importExport.chatsSectionTitle')}</h4>

  <div class="btn-row">
    <Button onclick={handleExport}>{$_('settings.importExport.exportBtnLabel')}</Button>

    <label class="import-label" role="button" tabindex="0">
      {$_('settings.importExport.importBtnLabel')}
      <input type="file" accept=".json" hidden onchange={handleImport} />
    </label>
  </div>
</section>

<style>
  h4 { font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.75rem; }
  .btn-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .import-label {
    display: inline-flex; align-items: center; padding: 0.375rem 0.75rem;
    border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-fg);
    font-size: 0.875rem; font-weight: 500; cursor: pointer;
  }
  .import-label:hover { background: var(--color-accent-hover); }
</style>
