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

  const generationKeys: ConfigurationKey[] = [
    'temperature',
    'top_k',
    'top_p',
    'min_p',
    'max_tokens',
  ];
  const samplerKeys: ConfigurationKey[] = [
    'samplers',
    'dynatemp_range',
    'dynatemp_exponent',
    'typical_p',
    'xtc_probability',
    'xtc_threshold',
  ];
  const penaltyKeys: ConfigurationKey[] = [
    'repeat_last_n',
    'repeat_penalty',
    'presence_penalty',
    'frequency_penalty',
    'dry_multiplier',
    'dry_base',
    'dry_allowed_length',
    'dry_penalty_last_n',
  ];
</script>

<section>
  <h4 class="section-heading section-heading--first">
    {$_('settings.sections.generation')}
  </h4>
  <SettingsField
    type="checkbox"
    configKey="overrideGenerationOptions"
    value={!!config.overrideGenerationOptions}
    onchange={onchange('overrideGenerationOptions')}
  />
  {#each generationKeys as key (key)}
    <SettingsField
      type="short"
      configKey={key}
      value={config[key] as string | number}
      disabled={!config.overrideGenerationOptions}
      onchange={onchange(key)}
    />
  {/each}

  <h4 class="section-heading">{$_('settings.sections.samplers')}</h4>
  <SettingsField
    type="checkbox"
    configKey="overrideSamplersOptions"
    value={!!config.overrideSamplersOptions}
    onchange={onchange('overrideSamplersOptions')}
  />
  {#each samplerKeys as key (key)}
    <SettingsField
      type="short"
      configKey={key}
      value={config[key] as string | number}
      disabled={!config.overrideSamplersOptions}
      onchange={onchange(key)}
    />
  {/each}

  <h4 class="section-heading">{$_('settings.sections.penalties')}</h4>
  <SettingsField
    type="checkbox"
    configKey="overridePenaltyOptions"
    value={!!config.overridePenaltyOptions}
    onchange={onchange('overridePenaltyOptions')}
  />
  {#each penaltyKeys as key (key)}
    <SettingsField
      type="short"
      configKey={key}
      value={config[key] as string | number}
      disabled={!config.overridePenaltyOptions}
      onchange={onchange(key)}
    />
  {/each}

  <h4 class="section-heading">{$_('settings.sections.custom')}</h4>
  <SettingsField
    type="long"
    configKey="custom"
    value={String(config.custom)}
    onchange={onchange('custom')}
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
