import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * app.html is the one place whose contents reach every generated page. The PWA
 * plugin offers to add some of this itself, but does so through Vite's HTML
 * transform, which SvelteKit's pages never pass through — so anything relying
 * on that is built, shipped and never referenced.
 */
const head = (() => {
  const html = readFileSync(resolve(process.cwd(), 'src/app.html'), 'utf8');
  const el = document.createElement('div');
  // Only the head is of interest, and a detached div will not keep <head>.
  el.innerHTML = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
  return el;
})();

describe('what every page carries', () => {
  it('links the web app manifest', () => {
    const link = head.querySelector('link[rel="manifest"]');

    // Without this the browser never reads the manifest: no name, no icons,
    // no display mode, and no install.
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('manifest.webmanifest');
  });

  it('asks for the manifest by a path the deployment resolves', () => {
    const href = head
      .querySelector('link[rel="manifest"]')
      ?.getAttribute('href');

    // A bare '/manifest.webmanifest' would look at the origin root, which is
    // not where an app served from a subdirectory keeps it.
    expect(href).toContain('%sveltekit.assets%');
  });

  it('names an icon for the browser tab', () => {
    expect(head.querySelector('link[rel="icon"]')).not.toBeNull();
  });

  it('declares a theme colour for the browser to paint with', () => {
    expect(head.querySelector('meta[name="theme-color"]')).not.toBeNull();
  });
});
