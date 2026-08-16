<script lang="ts">
  import { _ } from 'svelte-i18n';
  import CirclePlayIcon from 'lucide-svelte/icons/circle-play';
  import SaveIcon from 'lucide-svelte/icons/save';
  import Trash2Icon from 'lucide-svelte/icons/trash-2';
  import PencilIcon from 'lucide-svelte/icons/pencil';
  import { CONFIG_DEFAULT } from '$lib/config';
  import { modal } from '$lib/state/modal.svelte';
  import { toast } from '$lib/components/toast.js';
  import { dateFormatter } from '$lib/utils/formatting';
  import type { Configuration, ConfigurationPreset } from '$lib/types';
  import Button from '$lib/components/Button.svelte';

  interface Props {
    config: Configuration;
    presets: ConfigurationPreset[];
    onsavepreset: (name: string, config: Configuration) => Promise<void>;
    onremovepreset: (name: string) => Promise<void>;
    onsaveconfig: (config: Configuration) => Promise<void>;
  }

  let { config, presets, onsavepreset, onremovepreset, onsaveconfig }: Props =
    $props();

  async function handleSave() {
    const name = (
      (await modal.showPrompt(
        $_('settings.presetManager.modals.enterNewPresetName')
      )) ?? ''
    ).trim();
    if (!name) return;
    const existing = presets.find((p) => p.name === name);
    if (
      !existing ||
      (await modal.showConfirm(
        $_('settings.presetManager.modals.presetAlreadyExists', {
          values: { presetName: name },
        })
      ))
    ) {
      await onsavepreset(name, config);
      toast.success($_('state.preset.saved', { default: 'Preset saved' }));
    }
  }

  async function handleRename(preset: ConfigurationPreset) {
    const newName = (
      (await modal.showPrompt(
        $_('settings.presetManager.modals.enterNewName')
      )) ?? ''
    ).trim();
    if (!newName) return;
    await onremovepreset(preset.name);
    await onsavepreset(
      newName,
      Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFAULT)), preset.config)
    );
  }

  async function handleLoad(preset: ConfigurationPreset) {
    if (
      await modal.showConfirm(
        $_('settings.presetManager.modals.loadPresetConfirm', {
          values: { presetName: preset.name },
        })
      )
    ) {
      await onsaveconfig(
        Object.assign(JSON.parse(JSON.stringify(CONFIG_DEFAULT)), preset.config)
      );
    }
  }

  async function handleDelete(preset: ConfigurationPreset) {
    if (
      await modal.showConfirm(
        $_('settings.presetManager.modals.deletePresetConfirm', {
          values: { presetName: preset.name },
        })
      )
    ) {
      await onremovepreset(preset.name);
    }
  }
</script>

<section>
  <h4 class="section-heading section-heading--first">
    {$_('settings.presetManager.newPreset')}
  </h4>
  <Button variant="neutral" onclick={handleSave}>
    <SaveIcon size={16} />
    {$_('settings.presetManager.buttons.save')}
  </Button>

  <h4 class="section-heading">{$_('settings.presetManager.savedPresets')}</h4>

  {#if presets.length === 0}
    <p class="presets__empty">{$_('settings.presetManager.noPresetFound')}</p>
  {:else}
    <div class="presets__list">
      {#each [...presets].sort((a, b) => b.createdAt - a.createdAt) as preset (preset.id)}
        <div class="preset-card">
          <div class="preset-card__info">
            <strong>{preset.name}</strong>
            <span class="preset-card__date"
              >{$_('settings.presetManager.labels.created')}
              {dateFormatter.format(preset.createdAt)}</span
            >
          </div>
          <div class="preset-card__actions">
            <Button
              variant="ghost"
              size="icon-xl"
              onclick={() => handleLoad(preset)}
              aria-label={$_('settings.presetManager.buttons.load')}
            >
              <CirclePlayIcon size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onclick={() => handleRename(preset)}
              aria-label={$_('settings.presetManager.buttons.rename')}
            >
              <PencilIcon size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onclick={() => handleDelete(preset)}
              aria-label={$_('settings.presetManager.buttons.delete')}
            >
              <Trash2Icon size={14} />
            </Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
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

  .presets__empty {
    @apply text-xs;
    color: var(--color-text-muted);
  }

  .presets__list {
    @apply flex flex-col gap-2;
  }

  .preset-card {
    @apply flex items-center gap-2 p-3;
    background: var(--color-surface-alt);
    border-radius: var(--radius-md);
  }

  .preset-card__info {
    @apply flex-1 min-w-0 flex flex-col;
    gap: 0.125rem;
  }

  .preset-card__date {
    @apply text-xs;
    color: var(--color-text-muted);
  }

  .preset-card__actions {
    @apply flex items-center gap-1;
  }
</style>
