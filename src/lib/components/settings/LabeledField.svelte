<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { Snippet } from 'svelte';

  interface Props {
    configKey: string;
    children: Snippet<[{ label: string; note: string }]>;
  }

  let { configKey, children }: Props = $props();

  const label = $derived($_(`settings.parameters.${configKey}.label`, { default: configKey }));
  const note = $derived($_(`settings.parameters.${configKey}.note`, { default: '' }));
</script>

{@render children({ label, note })}
