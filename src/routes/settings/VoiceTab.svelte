<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { Configuration, ConfigurationKey } from '$lib/types';
  import SettingsField from '$lib/components/settings/SettingsField.svelte';

  interface Props {
    config: Configuration;
    onchange: (key: ConfigurationKey) => (value: string | number | boolean) => void;
  }

  let { config, onchange }: Props = $props();

  // TTS is out of scope for this migration (dropped feature)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
</script>

<section>
  <h4>{$_('settings.sections.textToSpeech')}</h4>
  {#if !supported}
    <p class="note">{$_('settings.textToSpeech.notSupported', { default: 'Text-to-speech is not supported in this browser.' })}</p>
  {:else}
    <SettingsField type="range" configKey="ttsPitch" value={config.ttsPitch} range={{ min: 0, max: 2, step: 0.5 }} onchange={onchange('ttsPitch')} />
    <SettingsField type="range" configKey="ttsRate" value={config.ttsRate} range={{ min: 0.5, max: 2, step: 0.5 }} onchange={onchange('ttsRate')} />
    <SettingsField type="range" configKey="ttsVolume" value={config.ttsVolume} range={{ min: 0, max: 1, step: 0.25 }} onchange={onchange('ttsVolume')} />
  {/if}
</section>

<style>
  h4 { font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.75rem; }
  .note { font-size: 0.875rem; color: var(--color-text-muted); }
</style>
