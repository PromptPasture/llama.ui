<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { app } from '$lib/state/app.svelte';
  import { toast } from '$lib/components/toast.js';
  import { modal } from '$lib/state/modal.svelte';
  import IndexedDB from '$lib/database/indexedDB';
  import LocalStorage from '$lib/database/localStorage';
  import { downloadAsFile } from '$lib/utils/downloadAsFile';
  import { historyToMarkdown } from '$lib/utils/history-markdown';
  import Button from '$lib/components/Button.svelte';

  interface Props {
    onclose: () => void;
    /** Starts the app again once everything has been forgotten. Injected so a
     * test does not have to reload the page it is running in. */
    onreload?: () => void;
  }

  let { onclose, onreload = () => window.location.reload() }: Props = $props();

  let fileInput: HTMLInputElement;

  /**
   * Which of these is under way, if any.
   *
   * They all read or write the same store — reading every conversation out
   * takes as long as the history is — and none of them should start while
   * another is running. Pressed with nothing to show for it, a button looks
   * like one that did nothing.
   */
  let running = $state<
    'export' | 'markdown' | 'import' | 'delete' | 'forget' | null
  >(null);

  /**
   * Runs one of them, and says so while it is running.
   *
   * @param what - Which action, so its own button can say it is working
   * @param action - The work to do
   */
  async function run(
    what: NonNullable<typeof running>,
    action: () => Promise<void>
  ): Promise<void> {
    running = what;
    try {
      await action();
    } catch (error) {
      // Each of these reports its own failure to the reader already. Letting
      // it out of here would only be an unhandled rejection from an onclick.
      console.error(`${what} failed:`, error);
    } finally {
      // Whatever happened, the section has to become usable again: a history
      // that cannot be read would otherwise lock all of it.
      running = null;
    }
  }

  async function handleExportNow() {
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

  /**
   * Writes the whole history out as one readable document.
   *
   * The JSON above goes back into the app; this is for keeping, for searching
   * in something else, or for leaving with.
   */
  async function handleExportMarkdownNow() {
    try {
      const conversations = await IndexedDB.getAllConversations();
      const transcripts = [];
      for (const conv of conversations) {
        const all = await IndexedDB.getMessages(conv.id);
        // The branch on screen, as copying and downloading one already do.
        transcripts.push({
          conv,
          messages: IndexedDB.filterByLeafNodeId(all, conv.currNode, false),
        });
      }
      const markdown = historyToMarkdown(transcripts, {
        user: $_('chatScreen.labels.user'),
        assistant: $_('chatScreen.labels.assistant'),
      });
      if (!markdown) return;
      const today = new Date().toISOString().slice(0, 10);
      downloadAsFile(
        [markdown],
        `llama-ui-conversations-${today}.md`,
        'text/markdown'
      );
      toast.success($_('state.database.export.completed'));
    } catch (error) {
      console.error('Writing the history out failed:', error);
      toast.error($_('state.database.export.failed'));
    }
  }

  async function handleImportNow(e: Event) {
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
  async function handleDeleteAllNow() {
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
  async function handleForgetEverythingNow() {
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

  const handleImport = (e: Event) => run('import', () => handleImportNow(e));
  const handleExport = () => run('export', handleExportNow);
  const handleExportMarkdown = () => run('markdown', handleExportMarkdownNow);
  const handleDeleteAll = () => run('delete', handleDeleteAllNow);
  const handleForgetEverything = () => run('forget', handleForgetEverythingNow);
</script>

<section>
  <h4 class="section-heading">
    {$_('settings.importExport.chatsSectionTitle')}
  </h4>

  <div class="import-export__actions">
    <!-- All of these read or write the same store, so while one is working
         none of the others can start, and the one working says so. -->
    <Button
      onclick={handleExport}
      disabled={running !== null}
      aria-busy={running === 'export'}
      >{$_('settings.importExport.exportBtnLabel')}</Button
    >

    <Button
      onclick={handleExportMarkdown}
      disabled={running !== null}
      aria-busy={running === 'markdown'}
      >{$_('settings.importExport.exportMarkdownBtnLabel')}</Button
    >

    <Button
      onclick={() => fileInput.click()}
      disabled={running !== null}
      aria-busy={running === 'import'}
      >{$_('settings.importExport.importBtnLabel')}</Button
    >
    <input
      bind:this={fileInput}
      type="file"
      accept=".json"
      hidden
      onchange={handleImport}
    />

    <Button
      variant="danger"
      onclick={handleDeleteAll}
      disabled={running !== null}
      aria-busy={running === 'delete'}
      >{$_('settings.importExport.deleteAllBtnLabel')}</Button
    >

    <Button
      variant="danger"
      onclick={handleForgetEverything}
      disabled={running !== null}
      aria-busy={running === 'forget'}
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
