import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ copyStr: vi.fn() }));
vi.mock('$lib/utils/dom-helpers', () => ({ copyStr: mocks.copyStr }));

const { default: MarkdownDisplay } = await import('./MarkdownDisplay.svelte');

beforeEach(() => {
  mocks.copyStr.mockClear();
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
