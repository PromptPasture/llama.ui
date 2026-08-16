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

  let fileInput: HTMLInputElement;

  async function handleExport() {
    const data = await app.exportDB(undefined, {
      success: toast.success,
      error: toast.error,
    });
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
  <h4 class="section-heading">
    {$_('settings.importExport.chatsSectionTitle')}
  </h4>

  <div class="import-export__actions">
    <Button onclick={handleExport}
      >{$_('settings.importExport.exportBtnLabel')}</Button
    >

    <Button onclick={() => fileInput.click()}
      >{$_('settings.importExport.importBtnLabel')}</Button
    >
    <input
      bind:this={fileInput}
      type="file"
      accept=".json"
      hidden
      onchange={handleImport}
    />
  </div>
</section>

<style>
  @reference "tailwindcss";
  .section-heading {
    @apply font-semibold m-0 mb-3;
    font-size: 0.9375rem;
  }

  .import-export__actions {
    @apply flex gap-2 flex-wrap;
  }
</style>
