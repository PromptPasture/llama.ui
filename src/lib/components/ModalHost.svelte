<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { modal } from '$lib/state/modal.svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import Input from './Input.svelte';

  let promptValue = $state('');

  $effect(() => {
    if (modal.current?.type === 'prompt') {
      promptValue = modal.current.defaultValue ?? '';
    }
  });
</script>

{#if modal.current?.type === 'confirm'}
  <Dialog open={true} title={modal.current.message} onclose={() => modal.respond(false)}>
    {#snippet children()}
      <span></span>
    {/snippet}
    {#snippet actions()}
      <Button variant="ghost" onclick={() => modal.respond(false)}>{$_('modals.cancelBtnLabel')}</Button>
      <Button variant="danger" onclick={() => modal.respond(true)}>{$_('modals.confirmBtnLabel')}</Button>
    {/snippet}
  </Dialog>
{/if}

{#if modal.current?.type === 'prompt'}
  <Dialog open={true} title={modal.current.message} onclose={() => modal.respond(undefined)}>
    {#snippet children()}
      <Input variant="bordered" bind:value={promptValue}
        onkeydown={(e) => { if (e.key === 'Enter') modal.respond(promptValue); }} />
    {/snippet}
    {#snippet actions()}
      <Button variant="ghost" onclick={() => modal.respond(undefined)}>{$_('modals.cancelBtnLabel')}</Button>
      <Button onclick={() => modal.respond(promptValue)}>{$_('modals.submitBtnLabel')}</Button>
    {/snippet}
  </Dialog>
{/if}

{#if modal.current?.type === 'alert'}
  <Dialog open={true} title={modal.current.message} onclose={() => modal.respond(undefined)}>
    {#snippet children()}
      <span></span>
    {/snippet}
    {#snippet actions()}
      <Button onclick={() => modal.respond(undefined)}>{$_('modals.okBtnLabel')}</Button>
    {/snippet}
  </Dialog>
{/if}
