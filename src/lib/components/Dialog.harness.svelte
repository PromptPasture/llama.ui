<script lang="ts">
  // Test-only parent: Dialog takes its content as a snippet, which cannot be
  // passed from a plain test file.
  import Dialog from './Dialog.svelte';

  interface Props {
    open?: boolean;
    title?: string;
    onclose?: () => void;
  }

  let {
    open = true,
    title = 'Delete everything?',
    onclose = () => {},
  }: Props = $props();
</script>

<Dialog {open} {title} {onclose}>
  <button type="button">Inside the dialog</button>
</Dialog>
