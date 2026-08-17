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
  <Dialog
    open={true}
    title={modal.current.message}
    onclose={() => modal.respond(false)}
  >
    <span></span>
    {#snippet actions()}
      <Button variant="ghost" onclick={() => modal.respond(false)}
        >{modal.current.labels?.cancel ?? $_('modals.cancelBtnLabel')}</Button
      >
      <Button
        variant={modal.current.labels?.danger === false ? 'default' : 'danger'}
        onclick={() => modal.respond(true)}
        >{modal.current.labels?.confirm ?? $_('modals.confirmBtnLabel')}</Button
      >
    {/snippet}
  </Dialog>
{/if}

{#if modal.current?.type === 'prompt'}
  <Dialog
    open={true}
    title={modal.current.message}
    onclose={() => modal.respond(undefined)}
  >
    <Input
      variant="bordered"
      bind:value={promptValue}
      onkeydown={(e) => {
        if (e.key === 'Enter') modal.respond(promptValue);
      }}
    />
    {#snippet actions()}
      <Button variant="ghost" onclick={() => modal.respond(undefined)}
        >{$_('modals.cancelBtnLabel')}</Button
      >
      <Button onclick={() => modal.respond(promptValue)}
        >{$_('modals.submitBtnLabel')}</Button
      >
    {/snippet}
  </Dialog>
{/if}

{#if modal.current?.type === 'alert'}
  <Dialog
    open={true}
    title={modal.current.message}
    onclose={() => modal.respond(undefined)}
  >
    <span></span>
    {#snippet actions()}
      <Button onclick={() => modal.respond(undefined)}
        >{$_('modals.okBtnLabel')}</Button
      >
    {/snippet}
  </Dialog>
{/if}
