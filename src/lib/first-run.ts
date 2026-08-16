import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { t } from '$lib/i18n/translate';
import { modal } from '$lib/state/modal.svelte';

/** How long to let the models arrive before concluding there are none. */
export const SETUP_GRACE_MS = 5000;

/**
 * Which wording fits: a first visit, or a provider that answered with nothing.
 *
 * Both have been translated in all twelve catalogues from the beginning. Only
 * one was ever shown, so a first-time visitor was told models could not be
 * found rather than being welcomed and shown where to start.
 *
 * @param baseUrl - The configured base url
 * @returns The catalogue section to take the wording from
 */
export function setupPrompt(baseUrl: string): 'welcomePopup' | 'noModelsPopup' {
  return baseUrl.trim() === '' ? 'welcomePopup' : 'noModelsPopup';
}

/**
 * Whether to interrupt with an offer to set a provider up.
 *
 * Not while the settings are already open — that is where the offer leads, and
 * someone reading them has found their own way there — and only once, so
 * declining is not asked again on every change.
 *
 * @param state - What the app knows once the models have had time to arrive
 * @returns Whether to make the offer
 */
export function shouldOfferSetup(state: {
  modelCount: number;
  onSettingsScreen: boolean;
  alreadyOffered: boolean;
}): boolean {
  return (
    state.modelCount === 0 && !state.onSettingsScreen && !state.alreadyOffered
  );
}

/**
 * Offers to open the settings when there is nothing to send a message to.
 *
 * The app cannot answer anything until an inference provider is configured,
 * and saying so in a message that disappears leaves the reader to find the
 * settings themselves.
 *
 * @param baseUrl - The configured base url, which decides the wording
 * @returns Whether the settings were opened.
 */
export async function offerToConfigure(baseUrl: string): Promise<boolean> {
  const section = setupPrompt(baseUrl);
  const open = await modal.showConfirm(t(`toast.${section}.description`), {
    confirm: t(`toast.${section}.submitBtnLabel`),
    cancel: t(`toast.${section}.cancelBtnLabel`),
  });
  if (open) await goto(resolve('/settings'));
  return open;
}
