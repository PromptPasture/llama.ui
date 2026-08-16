import { render, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, locale, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ goto: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));

const { default: Header } = await import('./Header.svelte');

beforeAll(async () => {
  register('en', () => import('../i18n/en.json'));
  register('ru', () => import('../i18n/ru.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(() => {
  mocks.goto.mockClear();
});

/**
 * The row the header shows on a narrow window. The other row is `hidden xl:flex`,
 * and jsdom loads no stylesheet, so the two can only be told apart structurally.
 */
function narrowWindowRow(container: HTMLElement) {
  const row = container.querySelector<HTMLElement>('.header__mobile-row');
  if (!row) throw new Error('the header no longer has a mobile row');
  return within(row);
}

describe('reaching the settings on a narrow window', () => {
  it('offers a settings button next to the title', async () => {
    const { container } = render(Header);

    // Below xl the desktop row is hidden, and the only other route to the
    // settings is Ctrl+, — which a phone or tablet cannot send.
    await userEvent.click(
      narrowWindowRow(container).getByLabelText('Open settings menu')
    );

    expect(mocks.goto).toHaveBeenCalledWith('/settings');
  });

  it('drops it once the settings are open', () => {
    const { container } = render(Header, { props: { showSettings: true } });

    expect(
      narrowWindowRow(container).queryByLabelText('Open settings menu')
    ).toBeNull();
  });

  it('still offers a new conversation there', async () => {
    const { container } = render(Header);

    await userEvent.click(
      narrowWindowRow(container).getByLabelText('New conversation')
    );

    expect(mocks.goto).toHaveBeenCalledWith('/');
  });
});

describe('the sidebar toggle', () => {
  it('reports the tap rather than navigating', async () => {
    const onsidebartoggle = vi.fn();
    const { container } = render(Header, { props: { onsidebartoggle } });

    await userEvent.click(
      narrowWindowRow(container).getByLabelText('Open sidebar')
    );

    expect(onsidebartoggle).toHaveBeenCalledOnce();
    expect(mocks.goto).not.toHaveBeenCalled();
  });
});

describe('the wording of the header controls', () => {
  it('names the sidebar toggle in the language being read', async () => {
    await locale.set('ru');
    await waitLocale();
    const { container } = render(Header);

    // Written into the markup, this stayed English for every reader.
    expect(
      narrowWindowRow(container).getByLabelText('Открыть боковую панель')
    ).toBeInTheDocument();

    await locale.set('en');
    await waitLocale();
  });
});
