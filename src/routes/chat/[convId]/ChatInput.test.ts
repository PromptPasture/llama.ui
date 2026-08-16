import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, locale, register, waitLocale } from 'svelte-i18n';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  isGenerating: vi.fn(() => false),
  stopGenerating: vi.fn(),
}));

vi.mock('$lib/state/chat.svelte', () => ({ chat: mocks }));

const { default: ChatInput } = await import('./ChatInput.svelte');

// Set the locale explicitly rather than through initI18n(), which picks its
// initial locale from navigator.language and is not deterministic here.
beforeAll(async () => {
  register('en', () => import('../../../lib/i18n/en.json'));
  register('ru', () => import('../../../lib/i18n/ru.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(() => {
  mocks.isGenerating.mockReturnValue(false);
  mocks.stopGenerating.mockClear();
});

function renderInput(onsend = vi.fn().mockResolvedValue(undefined)) {
  const result = render(ChatInput, { props: { convId: 'conv-1', onsend } });
  return { ...result, onsend, textarea: screen.getByRole('textbox') };
}

describe('ChatInput sending', () => {
  it('sends on Enter and clears the box', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();

    await user.type(textarea, 'hello{Enter}');

    expect(onsend).toHaveBeenCalledWith('hello', undefined);
    expect(textarea).toHaveValue('');
  });

  it('trims surrounding whitespace before sending', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();

    await user.type(textarea, '   spaced   {Enter}');

    expect(onsend).toHaveBeenCalledWith('spaced', undefined);
  });

  it('does not send on Shift+Enter, so a newline can be typed', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();

    await user.type(textarea, 'line1{Shift>}{Enter}{/Shift}line2');

    expect(onsend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('line1\nline2');
  });

  it('ignores an empty or whitespace-only message', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();

    await user.type(textarea, '{Enter}');
    await user.type(textarea, '   {Enter}');

    expect(onsend).not.toHaveBeenCalled();
  });

  it('sends when the send button is pressed', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();

    await user.type(textarea, 'via button');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onsend).toHaveBeenCalledWith('via button', undefined);
  });

  it('puts the text back when sending reports failure', async () => {
    const user = userEvent.setup();
    const onsend = vi.fn().mockResolvedValue(false);
    const { textarea } = renderInput(onsend);

    await user.type(textarea, 'unlucky{Enter}');

    // Losing what the user typed because the request failed would be worse
    // than leaving it in place.
    expect(textarea).toHaveValue('unlucky');
  });

  it('leaves the box empty when sending succeeds', async () => {
    const user = userEvent.setup();
    const onsend = vi.fn().mockResolvedValue(true);
    const { textarea } = renderInput(onsend);

    await user.type(textarea, 'fine{Enter}');

    expect(textarea).toHaveValue('');
  });
});

describe('ChatInput and input methods', () => {
  // Japanese, Korean and Chinese are typed by converting candidates and
  // pressing Enter to accept one — userEvent cannot express that, so the flag
  // the browser sets during composition is fired directly.
  const composingEnter = (textarea: HTMLElement) =>
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });

  it('leaves Enter to the input method while it is composing', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();

    await user.type(textarea, 'にほん');
    await composingEnter(textarea);

    // Sending here posts the unconverted reading and swallows the keystroke
    // meant to accept the conversion.
    expect(onsend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('にほん');
  });

  it('leaves Enter alone when only the legacy code says so', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();

    await user.type(textarea, 'にほん');
    // Some browsers report the Enter that accepts a conversion with
    // isComposing already false, and only this code to say what it was for.
    await fireEvent.keyDown(textarea, { key: 'Enter', keyCode: 229 });

    expect(onsend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('にほん');
  });

  it('sends on the Enter that follows, once composing has finished', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();

    await user.type(textarea, '日本');
    await composingEnter(textarea);
    // Asserted here too: without it the send below still looks right, because
    // the first Enter would have sent the message and emptied the box.
    expect(onsend).not.toHaveBeenCalled();

    await fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onsend).toHaveBeenCalledOnce();
    expect(onsend).toHaveBeenCalledWith('日本', undefined);
  });
});

describe('ChatInput while a reply is generating', () => {
  it('offers stop instead of send', () => {
    mocks.isGenerating.mockReturnValue(true);
    renderInput();

    expect(
      screen.getByRole('button', { name: 'Stop generation' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Send message' })
    ).not.toBeInTheDocument();
  });

  it('leaves the box usable, so the next message can be written', async () => {
    const user = userEvent.setup();
    mocks.isGenerating.mockReturnValue(true);
    const { textarea } = renderInput();

    await user.type(textarea, 'and another thing');

    expect(textarea).toBeEnabled();
    expect(textarea).toHaveValue('and another thing');
  });

  it('keeps the cursor in the box while the reply arrives', () => {
    mocks.isGenerating.mockReturnValue(true);
    const { textarea } = renderInput();

    textarea.focus();

    // A disabled field cannot hold focus, so disabling it took the cursor away
    // at the moment of sending and left it out until the reply finished.
    expect(textarea).toHaveFocus();
  });

  it('does not send on Enter while the reply is still arriving', async () => {
    const user = userEvent.setup();
    mocks.isGenerating.mockReturnValue(true);
    const { onsend, textarea } = renderInput();

    await user.type(textarea, 'queued up{Enter}');

    // Sending is refused further along anyway; what matters is that the
    // message is still there to send once the reply finishes.
    expect(onsend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('queued up');
  });

  it('stops generation for its own conversation', async () => {
    const user = userEvent.setup();
    mocks.isGenerating.mockReturnValue(true);
    renderInput();

    await user.click(screen.getByRole('button', { name: 'Stop generation' }));

    expect(mocks.stopGenerating).toHaveBeenCalledWith('conv-1');
  });
});

describe('ChatInput taking the cursor when a conversation opens', () => {
  /** jsdom answers every media query with `matches: false`. */
  const viewport = (wide: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: wide,
      media: query,
    }));

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is ready to type on the wide layout', () => {
    viewport(true);

    const { textarea } = renderInput();

    // Otherwise every conversation opens with a click before a word can be
    // written, which the original did not ask for.
    expect(textarea).toHaveFocus();
  });

  it('leaves it alone on a narrow one', () => {
    viewport(false);

    const { textarea } = renderInput();

    // Focusing here raises the on-screen keyboard over the conversation
    // before the reader has decided to write anything.
    expect(textarea).not.toHaveFocus();
  });
});

describe('the wording of the stop button', () => {
  it('is in the language being read', async () => {
    await locale.set('ru');
    await waitLocale();
    mocks.isGenerating.mockReturnValue(true);
    renderInput();

    // Written into the markup, this stayed English for every reader.
    expect(
      screen.getByRole('button', { name: 'Остановить генерацию' })
    ).toBeInTheDocument();

    await locale.set('en');
    await waitLocale();
  });
});
