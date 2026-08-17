<script lang="ts">
  import { _, locale } from 'svelte-i18n';
  import type { Configuration, ConfigurationKey } from '$lib/types';
  import { app } from '$lib/state/app.svelte';
  import SettingsField from '$lib/components/settings/SettingsField.svelte';
  import SettingsDropdownField from '$lib/components/settings/SettingsDropdownField.svelte';
  import { shortcutHint } from '$lib/utils/shortcuts';

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
   * Written the way the reader's own keyboard has them — Command where there
   * is a Command key — and derived so they follow the chosen language.
   */
  const SHORTCUTS = $derived([
    {
      keys: shortcutHint('N'),
      label: $_('settings.shortcuts.newConversation'),
    },
    { keys: shortcutHint('K'), label: $_('settings.shortcuts.search') },
    { keys: shortcutHint(','), label: $_('settings.shortcuts.settings') },
    { keys: 'Enter', label: $_('settings.shortcuts.send') },
    { keys: 'Shift+Enter', label: $_('settings.shortcuts.newline') },
    { keys: shortcutHint('Enter'), label: $_('settings.shortcuts.saveEdit') },
    { keys: 'Escape', label: $_('settings.shortcuts.escape') },
  ]);

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

<section>
  <h4 class="section-heading">{$_('settings.shortcuts.heading')}</h4>

  <!-- The buttons name their own shortcut in a tooltip, which a keyboard or a
       touchscreen never shows. This is where they can be read. -->
  <dl class="shortcuts">
    {#each SHORTCUTS as { keys, label } (label)}
      <div class="shortcuts__row">
        <dt class="shortcuts__keys">{keys}</dt>
        <dd class="shortcuts__what">{label}</dd>
      </div>
    {/each}
  </dl>
</section>

<style>
  @reference "tailwindcss";
  .shortcuts {
    @apply flex flex-col gap-1 m-0;
  }

  .shortcuts__row {
    @apply flex items-baseline gap-3 text-sm;
  }

  .shortcuts__keys {
    @apply shrink-0 px-1.5 py-0.5 rounded font-mono text-xs;
    min-width: 5.5rem;
    background: var(--color-surface-alt);
    border: 1px solid var(--color-border);
  }

  .shortcuts__what {
    @apply m-0;
    color: var(--color-text-muted);
  }

  .section-heading {
    @apply font-semibold m-0 mb-3;
    font-size: 0.9375rem;
  }
</style>
