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
  <h4 class="section-heading section-heading--first">
    {$_('settings.sections.chat')}
  </h4>
  <SettingsField
    type="short"
    configKey="pasteLongTextToFileLen"
    value={config.pasteLongTextToFileLen}
    onchange={onchange('pasteLongTextToFileLen')}
  />

  <h4 class="section-heading">{$_('settings.sections.performance')}</h4>
  <SettingsField
    type="checkbox"
    configKey="showTokensPerSecond"
    value={!!config.showTokensPerSecond}
    onchange={onchange('showTokensPerSecond')}
  />

  <h4 class="section-heading">{$_('settings.sections.reasoning')}</h4>
  <SettingsField
    type="checkbox"
    configKey="showThoughtInProgress"
    value={!!config.showThoughtInProgress}
    onchange={onchange('showThoughtInProgress')}
  />
  <SettingsField
    type="checkbox"
    configKey="excludeThoughtOnReq"
    value={!!config.excludeThoughtOnReq}
    onchange={onchange('excludeThoughtOnReq')}
  />
</section>

<style>
  @reference "tailwindcss";
  .section-heading {
    @apply font-semibold mt-4 mb-3;
    font-size: 0.9375rem;
  }
  .section-heading--first {
    margin-top: 0;
  }
</style>
