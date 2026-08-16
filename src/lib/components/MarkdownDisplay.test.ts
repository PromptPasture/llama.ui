import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, locale, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  copyStr: vi.fn().mockResolvedValue(true),
}));
vi.mock('$lib/utils/dom-helpers', () => ({ copyStr: mocks.copyStr }));

const { default: MarkdownDisplay } = await import('./MarkdownDisplay.svelte');
const { toast } = await import('$lib/components/toast');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  register('de', () => import('$lib/i18n/de.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(async () => {
  mocks.copyStr.mockClear();
  locale.set('en');
  await waitLocale('en');
});

/** Renders a message and presses the copy button on its code block. */
async function copyTheCodeBlock(content: string) {
  render(MarkdownDisplay, { props: { content } });
  await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
  return mocks.copyStr.mock.calls[0]?.[0];
}

describe('copying a code block', () => {
  it('copies what the block shows', async () => {
    expect(await copyTheCodeBlock('```js\nconst q = a && b;\n```')).toBe(
      'const q = a && b;'
    );
  });

  it('copies an entity as written, not as decoded', async () => {
    // Held in an attribute, this came back through the parser decoded: the
    // block showed `&amp;` and the clipboard got `&`.
    expect(await copyTheCodeBlock('```html\n<p>Tom &amp; Jerry</p>\n```')).toBe(
      '<p>Tom &amp; Jerry</p>'
    );
  });

  it('copies code that looks like markup', async () => {
    // DOMPurify dropped the attribute holding this outright, so the button
    // was there and did nothing at all.
    expect(
      await copyTheCodeBlock('```html\n<script>alert(1)</script>\n```')
    ).toBe('<script>alert(1)</script>');
  });

  it('copies quotes unchanged', async () => {
    expect(await copyTheCodeBlock('```js\nconst s = "hi";\n```')).toBe(
      'const s = "hi";'
    );
  });

  it('copies several lines', async () => {
    expect(await copyTheCodeBlock('```js\none();\ntwo();\n```')).toBe(
      'one();\ntwo();'
    );
  });

  it('says it has copied', async () => {
    render(MarkdownDisplay, { props: { content: '```js\nx\n```' } });

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });
});

describe('a message without code', () => {
  it('offers nothing to copy', () => {
    render(MarkdownDisplay, { props: { content: 'Just some prose.' } });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ignores a click on the text', async () => {
    render(MarkdownDisplay, { props: { content: 'Just some prose.' } });

    await userEvent.click(screen.getByText('Just some prose.'));

    expect(mocks.copyStr).not.toHaveBeenCalled();
  });
});

describe('the wording on the copy button', () => {
  it('follows the language the reader has chosen', async () => {
    locale.set('de');
    await waitLocale('de');

    render(MarkdownDisplay, { props: { content: '```js\nx\n```' } });

    // 'Copy' is translated in all twelve catalogues; the code block was the
    // one place that did not use it.
    expect(
      screen.getByRole('button', { name: 'Kopieren' })
    ).toBeInTheDocument();
  });

  it('changes when the language does', async () => {
    render(MarkdownDisplay, { props: { content: '```js\nx\n```' } });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();

    locale.set('de');
    await waitLocale('de');

    // The markup is derived from the locale as well as the content, so a
    // message already on screen is relabelled too.
    expect(
      await screen.findByRole('button', { name: 'Kopieren' })
    ).toBeInTheDocument();
  });

  it('goes back to the button wording after saying it has copied', async () => {
    // In German, so that restoring a hardcoded 'Copy' would show.
    locale.set('de');
    await waitLocale('de');
    vi.useFakeTimers();
    try {
      render(MarkdownDisplay, { props: { content: '```js\nx\n```' } });
      const btn = screen.getByRole('button', { name: 'Kopieren' });
      btn.click();

      await vi.advanceTimersByTimeAsync(1600);

      expect(btn.textContent).toBe('Kopieren');
    } finally {
      vi.useRealTimers();
    }
  });

  it('says it has copied, in English where nothing else exists yet', async () => {
    render(MarkdownDisplay, { props: { content: '```js\nx\n```' } });
    const btn = screen.getByRole('button', { name: 'Copy' });

    btn.click();

    // The only string here with no translation in the other eleven
    // catalogues; they fall back to this. Awaited because the button now
    // waits to know the copy worked before saying it did.
    await vi.waitFor(() => expect(btn.textContent).toBe('Copied!'));
  });
});

describe('a code copy the clipboard refuses', () => {
  it('does not say it has copied', async () => {
    mocks.copyStr.mockResolvedValueOnce(false);
    render(MarkdownDisplay, { props: { content: '```js\nx\n```' } });
    const btn = screen.getByRole('button', { name: 'Copy' });

    btn.click();
    await vi.waitFor(() => expect(mocks.copyStr).toHaveBeenCalled());

    // It used to say "Copied!" whatever happened, and the reader pasted
    // whatever was on the clipboard before.
    expect(btn.textContent).toBe('Copy');
  });

  it('says what went wrong instead', async () => {
    mocks.copyStr.mockResolvedValueOnce(false);
    const failed = vi.spyOn(toast, 'error').mockImplementation(() => {});
    render(MarkdownDisplay, { props: { content: '```js\nx\n```' } });

    screen.getByRole('button', { name: 'Copy' }).click();

    await vi.waitFor(() =>
      expect(failed).toHaveBeenCalledWith('Could not copy to the clipboard')
    );
    failed.mockRestore();
  });
});
