<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import type { Configuration, ConfigurationKey } from '$lib/types';
  import { app } from '$lib/state/app.svelte';
  import SettingsField from '$lib/components/settings/SettingsField.svelte';
  import SettingsDropdownField from '$lib/components/settings/SettingsDropdownField.svelte';

  const SUPPORTED_LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'zh-CN', label: '汉语' },
    { value: 'hi', label: 'हिन्दी' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'ru', label: 'Русский' },
    { value: 'pt', label: 'Português' },
    { value: 'de', label: 'Deutsch' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'it', label: 'Italiano' },
    { value: 'ar', label: 'اَلْعَرَبِيَّةُ' },
  ];

  // Derived, so the names follow the language rather than keeping whatever it
  // was when the tab first rendered.
  const THEMES = $derived([
    // The stored default, and the only way back to it once a theme is picked.
    { value: 'auto', label: $_('settings.themeManager.system') },
    { value: 'light', label: $_('settings.themeManager.light') },
    { value: 'dark', label: $_('settings.themeManager.dark') },
  ]);

  interface Props {
    config: Configuration;
    onchange: (
      key: ConfigurationKey
    ) => (value: string | number | boolean) => void;
  }

  let { config, onchange }: Props = $props();

  /**
   * Which entry in the list the interface is actually using. Browsers report a
   * region — 'en-US', 'de-DE' — and svelte-i18n keeps the tag it was given, so
   * matching it against the list directly leaves the field blank for almost
   * everyone who has not chosen a language. Narrow it the same way svelte-i18n
   * resolves a catalogue: exact tag, then the base language, then the fallback.
   */
  const currentLocale = $derived.by(() => {
    const supported = (tag?: string | null) =>
      SUPPORTED_LANGUAGES.some((l) => l.value === tag) ? tag : undefined;
    return supported($locale) ?? supported($locale?.split('-')[0]) ?? 'en';
  });
</script>

<section>
  <h4 class="section-heading">{$_('settings.sections.userInterface')}</h4>

  <SettingsField
    type="short"
    configKey="initials"
    value={String(config.initials)}
    onchange={onchange('initials')}
  />

  <SettingsDropdownField
    configKey="language"
    value={currentLocale}
    options={SUPPORTED_LANGUAGES}
    onchange={(v) => app.switchLanguage(String(v))}
  />

  <SettingsDropdownField
    configKey="theme"
    value={app.currentTheme}
    options={THEMES}
    onchange={(v) => app.switchTheme(String(v))}
  />

  <SettingsField
    type="checkbox"
    configKey="showRawUserMessage"
    value={!!config.showRawUserMessage}
    onchange={onchange('showRawUserMessage')}
  />
  <SettingsField
    type="checkbox"
    configKey="showRawAssistantMessage"
    value={!!config.showRawAssistantMessage}
    onchange={onchange('showRawAssistantMessage')}
  />
  <SettingsField
    type="short"
    configKey="pasteLongTextToFileLen"
    value={Number(config.pasteLongTextToFileLen)}
    onchange={onchange('pasteLongTextToFileLen')}
  />
</section>

<style>
  @reference "tailwindcss";
  .section-heading {
    @apply font-semibold m-0 mb-3;
    font-size: 0.9375rem;
  }
</style>
