<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { RefreshCwIcon } from 'lucide-svelte';
  import { INFERENCE_PROVIDERS } from '$lib/config';
  import type { Configuration, ConfigurationKey, InferenceApiModel } from '$lib/types';
  import Button from '$lib/components/Button.svelte';
  import SettingsField from '$lib/components/settings/SettingsField.svelte';
  import SettingsDropdownField from '$lib/components/settings/SettingsDropdownField.svelte';

  interface Props {
    config: Configuration;
    models: InferenceApiModel[];
    onchange: (key: ConfigurationKey) => (value: string | number | boolean) => void;
    onfetchmodels: () => Promise<void>;
  }

  let { config, models, onchange, onfetchmodels }: Props = $props();

  const providerOptions = Object.entries(INFERENCE_PROVIDERS).map(([key, val]) => ({
    value: key,
    label: val.name,
  }));

  const modelOptions = $derived(models.map((m) => ({ value: m.id, label: m.name })));
</script>

<section>
  <h4 class="section-heading section-heading--first">{$_('settings.sections.inferenceProvider')}</h4>

  <SettingsDropdownField
    configKey="provider"
    value={String(config.provider)}
    options={providerOptions}
    onchange={onchange('provider')}
  />

  <SettingsField
    type="short"
    configKey="baseUrl"
    value={String(config.baseUrl)}
    disabled={!INFERENCE_PROVIDERS[config.provider]?.allowCustomBaseUrl}
    onchange={onchange('baseUrl')}
  />

  <SettingsField
    type="short"
    configKey="apiKey"
    value={String(config.apiKey)}
    onchange={onchange('apiKey')}
  />

  <SettingsDropdownField
    configKey="model"
    value={String(config.model)}
    options={modelOptions}
    filterable
    onchange={onchange('model')}
  />

  <Button variant="neutral" onclick={onfetchmodels}>
    <RefreshCwIcon size={14} />
    {$_('settings.actionButtons.fetchModels')}
  </Button>

  <div class="spacer"></div>

  <SettingsField
    type="long"
    configKey="systemMessage"
    value={String(config.systemMessage)}
    onchange={onchange('systemMessage')}
  />
</section>

<style>
  @reference "tailwindcss";
  .section-heading {
    @apply font-semibold m-0 mb-3;
    font-size: 0.9375rem;
  }
  .section-heading--first { margin-top: 0; }
  .spacer { height: 1rem; }
</style>
