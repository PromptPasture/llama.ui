<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { Configuration, ConfigurationKey } from '$lib/types';
  import SettingsField from '$lib/components/settings/SettingsField.svelte';

  interface Props {
    config: Configuration;
    onchange: (
      key: ConfigurationKey
    ) => (value: string | number | boolean) => void;
  }

  let { config, onchange }: Props = $props();
</script>

<section>
  <div class="experimental-notice">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- translation string from src/lib/i18n, not user input -->
    {@html $_('settings.parameters.experimental.note', {
      default: '⚠ Experimental features may be unstable.',
    })}
  </div>
  <SettingsField
    type="checkbox"
    configKey="pyIntepreterEnabled"
    value={!!config.pyIntepreterEnabled}
    onchange={onchange('pyIntepreterEnabled')}
  />
</section>

<style>
  @reference "tailwindcss";
  .experimental-notice {
    @apply p-3 text-sm mb-4;
    background: var(--color-surface-alt);
    border-radius: var(--radius-md);
    color: var(--color-warning);
  }
</style>
