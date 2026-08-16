<script lang="ts">
  // Test-only parent: binds to Input so the write-back can be observed.
  import type { FormEventHandler } from 'svelte/elements';
  import Input from './Input.svelte';

  interface Props {
    initial?: string;
    variant?: 'text' | 'file' | 'input' | 'bordered' | 'toggle' | 'range';
    oninput?: FormEventHandler<HTMLInputElement>;
  }

  let { initial = '', variant = 'bordered', oninput }: Props = $props();

  // Seeded once on purpose, standing in for a parent's own state.
  // svelte-ignore state_referenced_locally
  let value = $state(initial);
</script>

<Input {variant} bind:value {oninput} />
<output data-testid="bound">{value}</output>
