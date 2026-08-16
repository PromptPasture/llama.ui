<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import type { Configuration, ConfigurationKey } from '$lib/types';
  import { tts } from '$lib/state/tts.svelte';
  import Button from '$lib/components/Button.svelte';
  import SettingsField from '$lib/components/settings/SettingsField.svelte';
  import SettingsDropdownField from '$lib/components/settings/SettingsDropdownField.svelte';

  interface Props {
    config: Configuration;
    onchange: (
      key: ConfigurationKey
    ) => (value: string | number | boolean) => void;
  }

  let { config, onchange }: Props = $props();

  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  onMount(() => {
    tts.loadVoices();
    // Nothing should still be talking after the settings are closed.
    return () => tts.stop();
  });

  const voiceOptions = $derived([
    // The stored default is the empty string, so without an entry for it the
    // field reads blank until a voice is picked.
    { value: '', label: 'System default' },
    ...tts.voices.map((v) => ({
      value: v.name,
      label: `${v.name} (${v.lang})`,
    })),
  ]);
</script>

<section>
  <h4 class="section-heading">{$_('settings.sections.textToSpeech')}</h4>
  {#if !supported}
    <p class="voice__unsupported">
      {$_('settings.textToSpeech.notSupported', {
        default: 'Text-to-speech is not supported in this browser.',
      })}
    </p>
  {:else}
    <SettingsDropdownField
      configKey="ttsVoice"
      value={config.ttsVoice}
      options={voiceOptions}
      filterable={true}
      onchange={onchange('ttsVoice')}
    />
    <SettingsField
      type="range"
      configKey="ttsPitch"
      value={config.ttsPitch}
      range={{ min: 0, max: 2, step: 0.5 }}
      onchange={onchange('ttsPitch')}
    />
    <SettingsField
      type="range"
      configKey="ttsRate"
      value={config.ttsRate}
      range={{ min: 0.5, max: 2, step: 0.5 }}
      onchange={onchange('ttsRate')}
    />
    <SettingsField
      type="range"
      configKey="ttsVolume"
      value={config.ttsVolume}
      range={{ min: 0, max: 1, step: 0.25 }}
      onchange={onchange('ttsVolume')}
    />

    <!-- These settings are only judgeable by ear, and they apply to replies
         that are not on this screen. -->
    <Button
      variant="neutral"
      onclick={() =>
        tts.isPreviewing()
          ? tts.stop()
          : tts.preview($_('settings.textToSpeech.check.text'), config)}
    >
      {tts.isPreviewing()
        ? $_('chatScreen.titles.stop')
        : $_('settings.textToSpeech.check.label')}
    </Button>
  {/if}
</section>

<style>
  @reference "tailwindcss";
  .section-heading {
    @apply font-semibold m-0 mb-3;
    font-size: 0.9375rem;
  }

  .voice__unsupported {
    @apply text-sm;
    color: var(--color-text-muted);
  }
</style>
