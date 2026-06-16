<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { Configuration, ConfigurationKey } from '$lib/types';
  import SettingsField from '$lib/components/settings/SettingsField.svelte';

  interface Props {
    config: Configuration;
    onchange: (key: ConfigurationKey) => (value: string | number | boolean) => void;
  }

  let { config, onchange }: Props = $props();
</script>

<section>
  <div class="warning">{@html $_('settings.parameters.experimental.note', { default: '⚠ Experimental features may be unstable.' })}</div>
  <SettingsField type="checkbox" configKey="pyIntepreterEnabled" value={!!config.pyIntepreterEnabled} onchange={onchange('pyIntepreterEnabled')} />
</section>

<style>
  .warning { background: var(--color-surface-alt); border-radius: var(--radius-md); padding: 0.75rem; font-size: 0.875rem; margin-bottom: 1rem; color: var(--color-warning); }
</style>
