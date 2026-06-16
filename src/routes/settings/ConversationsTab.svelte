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
  <h4>{$_('settings.sections.chat')}</h4>
  <SettingsField type="short" configKey="pasteLongTextToFileLen" value={config.pasteLongTextToFileLen} onchange={onchange('pasteLongTextToFileLen')} />

  <h4>{$_('settings.sections.performance')}</h4>
  <SettingsField type="checkbox" configKey="showTokensPerSecond" value={!!config.showTokensPerSecond} onchange={onchange('showTokensPerSecond')} />

  <h4>{$_('settings.sections.reasoning')}</h4>
  <SettingsField type="checkbox" configKey="showThoughtInProgress" value={!!config.showThoughtInProgress} onchange={onchange('showThoughtInProgress')} />
  <SettingsField type="checkbox" configKey="excludeThoughtOnReq" value={!!config.excludeThoughtOnReq} onchange={onchange('excludeThoughtOnReq')} />
</section>

<style>
  h4 { font-size: 0.9375rem; font-weight: 600; margin: 1rem 0 0.75rem; }
  h4:first-child { margin-top: 0; }
</style>
