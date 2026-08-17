<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { app } from '$lib/state/app.svelte';
  import { toast } from '$lib/components/toast.js';
  import { modal } from '$lib/state/modal.svelte';
  import IndexedDB from '$lib/database/indexedDB';
  import LocalStorage from '$lib/database/localStorage';
  import { downloadAsFile } from '$lib/utils/downloadAsFile';
  import Button from '$lib/components/Button.svelte';

  interface Props {
    onclose: () => void;
    /** Starts the app again once everything has been forgotten. Injected so a
     * test does not have to reload the page it is running in. */
    onreload?: () => void;
  }

  let { onclose, onreload = () => window.location.reload() }: Props = $props();

  let fileInput: HTMLInputElement;

  async function handleExport() {
    const data = await app.exportDB(undefined, {
      success: toast.success,
      error: toast.error,
    });
    // Dated, so successive backups sit beside each other rather than being
    // told apart by the browser appending (1) to the second one.
    const today = new Date().toISOString().slice(0, 10);
    downloadAsFile(
      [JSON.stringify(data, null, 2)],
      `llama-ui-database-${today}.json`
    );
  }

  async function handleImport(e: Event) {
    const input = e.target as HTMLInputElement;
    try {
      const files = input.files;
      if (!files || files.length !== 1) return;
      const text = await files[0].text();
      await app.importDB(text, { success: toast.success, error: toast.error });
      onclose();
    } catch {
      // importDB has already raised a toast; swallowing keeps the rejection
      // from going unhandled.
    } finally {
      // Clearing the value lets the same file be chosen again. Without it a
      // rejected import cannot be retried after fixing the file, because
      // selecting an unchanged value fires no change event.
      input.value = '';
    }
  }

  /**
   * Clears the history, which is otherwise a conversation at a time.
   *
   * Everything is kept in this browser and nowhere else, so this is the only
   * way to hand the machine on, or to start again, without deleting several
   * hundred conversations by hand.
   */
  async function handleDeleteAll() {
    let conversations;
    try {
      conversations = await IndexedDB.getAllConversations();
    } catch (error) {
      console.error('Reading the conversations failed:', error);
      toast.error($_('settings.importExport.deleteAllFailed'));
      return;
    }
    if (conversations.length === 0) return;

    const sure = await modal.showConfirm(
      $_('settings.importExport.deleteAllConfirm', {
        values: { count: conversations.length },
      })
    );
    if (!sure) return;

    try {
      const deleted = await IndexedDB.deleteAllConversations();
      toast.success(
        $_('settings.importExport.deleteAllDone', {
          values: { count: deleted },
        })
      );
    } catch (error) {
      // Some may have gone already; saying nothing would leave the reader
      // believing the rest went too.
      console.error('Deleting the conversations failed:', error);
      toast.error($_('settings.importExport.deleteAllFailed'));
    }
  }

  /**
   * Leaves nothing behind: the conversations, the presets, and the
   * configuration with the api key in it.
   *
   * Deleting the conversations is not enough for handing the machine on — the
   * credential is the part that matters, and it lives in the settings and in
   * every preset that was saved from them.
   *
   * The page is reloaded rather than the state being rebuilt: what is in
   * memory is the configuration that has just been forgotten.
   */
  async function handleForgetEverything() {
    const sure = await modal.showConfirm(
      $_('settings.importExport.forgetAllConfirm')
    );
    if (!sure) return;

    try {
      await IndexedDB.forgetEverything();
      LocalStorage.forgetEverything();
    } catch (error) {
      // Some of it may have gone; saying nothing would leave the reader
      // believing the key went with it.
      console.error('Forgetting everything failed:', error);
      toast.error($_('settings.importExport.forgetAllFailed'));
      return;
    }
    onreload();
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

    <Button variant="danger" onclick={handleDeleteAll}
      >{$_('settings.importExport.deleteAllBtnLabel')}</Button
    >

    <Button variant="danger" onclick={handleForgetEverything}
      >{$_('settings.importExport.forgetAllBtnLabel')}</Button
    >
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
