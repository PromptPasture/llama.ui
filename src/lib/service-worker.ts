import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker, and offers the update once one is waiting.
 *
 * The plugin can inject the registration into the page itself, but it does so
 * through Vite's HTML transform, which SvelteKit's generated pages never pass
 * through — so registerSW.js was built and shipped on every visit without
 * anything ever loading it. Nothing was cached and the app could not run
 * offline, despite carrying a service worker and a precache manifest.
 *
 * A new worker waits rather than replacing the old one, and only takes over
 * once every tab of the app has closed. Asking is what turns an update the
 * reader has not noticed into one they have.
 *
 * @param confirmUpdate - Asks whether to take the update now. Applying it
 *   reloads the page, so the answer has to be the reader's.
 */
export function startServiceWorker(
  confirmUpdate: () => Promise<boolean>
): void {
  const update = registerSW({
    onNeedRefresh: () => {
      // Not an async callback: registerSW wants one that returns nothing, and
      // a rejection from the dialog would have gone nowhere.
      void confirmUpdate().then((confirmed) => {
        if (confirmed) void update(true);
      });
    },
  });
}
