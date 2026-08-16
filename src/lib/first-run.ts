import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { t } from '$lib/i18n/translate';
import { modal } from '$lib/state/modal.svelte';

/**
 * Offers to open the settings when there is nothing to send a message to.
 *
 * The app cannot answer anything until an inference provider is configured,
 * and saying so in a message that disappears leaves the reader to find the
 * settings themselves. The catalogues have carried the wording for this in
 * twelve languages, buttons included, since before it was reachable.
 *
 * @returns Whether the settings were opened.
 */
export async function offerToConfigure(): Promise<boolean> {
  const open = await modal.showConfirm(t('toast.noModelsPopup.description'), {
    confirm: t('toast.noModelsPopup.submitBtnLabel'),
    cancel: t('toast.noModelsPopup.cancelBtnLabel'),
  });
  if (open) await goto(resolve('/settings'));
  return open;
}
