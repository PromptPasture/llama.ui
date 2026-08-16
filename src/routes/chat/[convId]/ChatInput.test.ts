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
const { app } = await import('$lib/state/app.svelte');
const { toast } = await import('$lib/components/toast');
const { forgetAllAttachments } = await import('$lib/utils/attachments');

// Set the locale explicitly rather than through initI18n(), which picks its
// initial locale from navigator.language and is not deterministic here.
beforeAll(async () => {
  register('en', () => import('../../../lib/i18n/en.json'));
  register('ru', () => import('../../../lib/i18n/ru.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(() => {
  // An unsent message is kept for the next visit, including the next test.
  localStorage.clear();
  forgetAllAttachments();
  mocks.isGenerating.mockReturnValue(false);
  mocks.stopGenerating.mockClear();
});

function renderInput(onsend = vi.fn().mockResolvedValue(undefined)) {
  const result = render(ChatInput, { props: { convId: 'conv-1', onsend } });
  // The picker itself is plumbing behind the attach button, so it is out of
  // the accessibility tree and has to be reached directly.
  const filePicker =
    result.container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!filePicker) throw new Error('the box has no file picker');
  return {
    ...result,
    onsend,
    filePicker,
    textarea: screen.getByRole('textbox'),
  };
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

describe('the message box remembering what was typed', () => {
  it('has it waiting when the conversation is opened again', async () => {
    const user = userEvent.setup();
    const first = renderInput();
    await user.type(first.textarea, 'half a thought');
    first.unmount();

    const { textarea } = renderInput();

    expect(textarea).toHaveValue('half a thought');
  });

  it('forgets a message once it has been sent', async () => {
    const user = userEvent.setup();
    const first = renderInput();
    await user.type(first.textarea, 'a question{Enter}');
    first.unmount();

    const { textarea } = renderInput();

    // Otherwise reopening the conversation refills the box with the message
    // that was already sent, ready to be sent a second time.
    expect(textarea).toHaveValue('');
  });

  it('keeps a message the send refused', async () => {
    const user = userEvent.setup();
    // What sending does when there is no provider configured yet.
    const first = renderInput(vi.fn().mockResolvedValue(false));
    await user.type(first.textarea, 'a question{Enter}');
    first.unmount();

    const { textarea } = renderInput();

    expect(textarea).toHaveValue('a question');
  });
});

describe('the message box being announced', () => {
  it('says what it is for', () => {
    renderInput();

    // The label used to sit on the wrapping div, which has no role and so is
    // not exposed at all: the box was left with only its placeholder.
    expect(
      screen.getByRole('textbox', { name: 'Chat input' })
    ).toBeInTheDocument();
  });
});

describe('pasting more than the box can hold', () => {
  const LONG = 'x'.repeat(200);

  /** userEvent.paste puts the text on the clipboard the component reads. */
  async function pasteInto(
    user: ReturnType<typeof userEvent.setup>,
    textarea: HTMLElement,
    text: string
  ) {
    await user.click(textarea);
    await user.paste(text);
  }

  beforeEach(() => {
    app.saveConfig({ ...app.config, pasteLongTextToFileLen: 100 });
  });

  it('keeps a long paste out of the box', async () => {
    const user = userEvent.setup();
    const { textarea } = renderInput();

    await pasteInto(user, textarea, LONG);

    // Thousands of lines in the box push the conversation off the screen and
    // leave the writer scrolling inside a textarea to find their question.
    expect(textarea).toHaveValue('');
  });

  it('shows what it attached instead', async () => {
    const user = userEvent.setup();
    const { textarea } = renderInput();

    await pasteInto(user, textarea, LONG);

    expect(screen.getByText('Pasted text 1')).toBeInTheDocument();
  });

  it('leaves a short paste in the box', async () => {
    const user = userEvent.setup();
    const { textarea } = renderInput();

    await pasteInto(user, textarea, 'a short quote');

    expect(textarea).toHaveValue('a short quote');
    expect(screen.queryByText(/Pasted text/)).not.toBeInTheDocument();
  });

  it('leaves every paste in the box when the limit is zero', async () => {
    app.saveConfig({ ...app.config, pasteLongTextToFileLen: 0 });
    const user = userEvent.setup();
    const { textarea } = renderInput();

    await pasteInto(user, textarea, LONG);

    expect(textarea).toHaveValue(LONG);
  });

  it('gives each paste a name of its own', async () => {
    const user = userEvent.setup();
    const { textarea } = renderInput();

    await pasteInto(user, textarea, LONG);
    await pasteInto(user, textarea, LONG);

    expect(screen.getByText('Pasted text 1')).toBeInTheDocument();
    expect(screen.getByText('Pasted text 2')).toBeInTheDocument();
  });

  it('lets one be taken off again', async () => {
    const user = userEvent.setup();
    const { textarea } = renderInput();
    await pasteInto(user, textarea, LONG);

    await user.click(screen.getByRole('button', { name: 'Remove file' }));

    expect(screen.queryByText('Pasted text 1')).not.toBeInTheDocument();
  });

  it('does not reuse the name of one that was taken off', async () => {
    const user = userEvent.setup();
    const { textarea } = renderInput();
    await pasteInto(user, textarea, LONG);
    await user.click(screen.getByRole('button', { name: 'Remove file' }));

    await pasteInto(user, textarea, LONG);

    // Two attachments sharing a name is ambiguous to read and ambiguous to
    // key the list by.
    expect(screen.getByText('Pasted text 2')).toBeInTheDocument();
  });
});

describe('sending what was attached', () => {
  const LONG = 'x'.repeat(200);

  beforeEach(() => {
    app.saveConfig({ ...app.config, pasteLongTextToFileLen: 100 });
  });

  it('sends it along with the message', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();
    await user.click(textarea);
    await user.paste(LONG);

    await user.type(textarea, 'what went wrong here?{Enter}');

    expect(onsend).toHaveBeenCalledWith('what went wrong here?', [
      { type: 'textFile', name: 'Pasted text 1', content: LONG },
    ]);
  });

  it('sends an attachment with no message at all', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();
    await user.click(textarea);
    await user.paste(LONG);

    await user.type(textarea, '{Enter}');

    // The question may already have been asked; the paste is the answer to it.
    expect(onsend).toHaveBeenCalledWith('', [
      { type: 'textFile', name: 'Pasted text 1', content: LONG },
    ]);
  });

  it('still refuses an empty message with nothing attached', async () => {
    const user = userEvent.setup();
    const { onsend, textarea } = renderInput();

    await user.type(textarea, '{Enter}');

    expect(onsend).not.toHaveBeenCalled();
  });

  it('clears the attachments once they have gone', async () => {
    const user = userEvent.setup();
    const { textarea } = renderInput();
    await user.click(textarea);
    await user.paste(LONG);

    await user.type(textarea, 'a question{Enter}');

    expect(screen.queryByText('Pasted text 1')).not.toBeInTheDocument();
  });

  it('keeps them when the send is refused', async () => {
    const user = userEvent.setup();
    const { textarea } = renderInput(vi.fn().mockResolvedValue(false));
    await user.click(textarea);
    await user.paste(LONG);

    await user.type(textarea, 'a question{Enter}');

    // Nothing was sent, so nothing should have to be pasted again.
    expect(screen.getByText('Pasted text 1')).toBeInTheDocument();
  });
});

describe('two attachments that share a name', () => {
  it('shows both of them', async () => {
    const user = userEvent.setup();
    const { textarea, filePicker } = renderInput();
    const file = () =>
      new File(['a long log'], 'log.txt', { type: 'text/plain' });

    await user.upload(filePicker, [file(), file()]);

    // Attaching the same file twice is a thing people do; keying the list by
    // name crashes the render outright.
    expect(screen.getAllByText('log.txt')).toHaveLength(2);
    expect(textarea).toBeInTheDocument();
  });
});

describe('attaching a file', () => {
  const textFile = (name: string, content: string) =>
    new File([content], name, { type: 'text/plain' });

  it('reads it into the message', async () => {
    const user = userEvent.setup();
    const { filePicker } = renderInput();

    await user.upload(filePicker, textFile('notes.txt', 'the contents'));

    expect(screen.getByText('notes.txt')).toBeInTheDocument();
  });

  it('sends what the file held', async () => {
    const user = userEvent.setup();
    const { onsend, textarea, filePicker } = renderInput();
    await user.upload(filePicker, textFile('notes.txt', 'the contents'));

    await user.type(textarea, 'what is this?{Enter}');

    expect(onsend).toHaveBeenCalledWith('what is this?', [
      { type: 'textFile', name: 'notes.txt', content: 'the contents' },
    ]);
  });

  it('takes several at once', async () => {
    const user = userEvent.setup();
    const { filePicker } = renderInput();

    await user.upload(filePicker, [
      textFile('one.txt', 'a'),
      textFile('two.txt', 'b'),
    ]);

    expect(screen.getByText('one.txt')).toBeInTheDocument();
    expect(screen.getByText('two.txt')).toBeInTheDocument();
  });

  it('refuses one that is not text', async () => {
    const user = userEvent.setup();
    const failed = vi.spyOn(toast, 'error');
    const { filePicker } = renderInput();

    const binary = new File([new Uint8Array([0x89, 0x50, 0, 0x47])], 'a.png');
    await user.upload(filePicker, binary);

    // Decoded as text it is pages of replacement characters, which say
    // nothing to a model and would be sent all the same.
    expect(failed).toHaveBeenCalledWith(
      'File is binary. Please upload a text file.'
    );
    expect(screen.queryByText('a.png')).not.toBeInTheDocument();
    failed.mockRestore();
  });

  it('says how large a file it will take', async () => {
    const user = userEvent.setup();
    const failed = vi.spyOn(toast, 'error');
    const { filePicker } = renderInput();

    const huge = textFile('huge.txt', 'x');
    Object.defineProperty(huge, 'size', { value: 20 * 1024 * 1024 });
    await user.upload(filePicker, huge);

    // The message used to name a limit of 500MB that nothing enforced.
    expect(failed).toHaveBeenCalledWith(
      'File is too large. Maximum size is 10MB.'
    );
    failed.mockRestore();
  });

  it('keeps the others when one of them fails', async () => {
    const user = userEvent.setup();
    const { filePicker } = renderInput();

    const binary = new File([new Uint8Array([0, 1])], 'a.png');
    await user.upload(filePicker, [binary, textFile('notes.txt', 'kept')]);

    expect(screen.getByText('notes.txt')).toBeInTheDocument();
  });

  it('lets go of the file once it has read it', async () => {
    const user = userEvent.setup();
    const { filePicker } = renderInput();

    await user.upload(filePicker, textFile('notes.txt', 'a'));

    // A real file input holding the same value is not a change, so picking
    // the same file a second time would raise no event at all. jsdom fires
    // one regardless, so the cleared value is what there is to check.
    expect(filePicker.value).toBe('');
  });
});

describe('dropping a file on the message box', () => {
  /** What a browser sends when files are dragged over and let go. */
  function dropEvent(files: File[]) {
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files } });
    return event;
  }

  it('attaches it', async () => {
    const { container } = renderInput();
    const area = container.querySelector('.chat-input');
    if (!area) throw new Error('the box has no drop target');

    const file = new File(['the contents'], 'dropped.txt');
    area.dispatchEvent(dropEvent([file]));
    await vi.waitFor(() =>
      expect(screen.getByText('dropped.txt')).toBeInTheDocument()
    );
  });

  it('leaves a drop of something else alone', async () => {
    const { container } = renderInput();
    const area = container.querySelector('.chat-input');
    if (!area) throw new Error('the box has no drop target');

    const event = dropEvent([]);
    area.dispatchEvent(event);

    // Dragged text, not files: the browser's own handling should stand.
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('attaching a picture', () => {
  const png = (name = 'shot.png') =>
    new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0])], name, {
      type: 'image/png',
    });

  /** Reading a picture goes through FileReader, which reports back later. */
  const attachedNamed = (name: string) =>
    vi.waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());

  it('takes it rather than refusing it as binary', async () => {
    const user = userEvent.setup();
    const failed = vi.spyOn(toast, 'error');
    const { filePicker } = renderInput();

    await user.upload(filePicker, png());

    await attachedNamed('shot.png');
    expect(failed).not.toHaveBeenCalled();
    failed.mockRestore();
  });

  it('shows it, rather than only naming it', async () => {
    const user = userEvent.setup();
    const { container, filePicker } = renderInput();

    await user.upload(filePicker, png());

    // Which picture was attached is not something a file name answers. The
    // thumbnail is decorative, so it is found by sight rather than by name.
    await attachedNamed('shot.png');
    const thumbnail = container.querySelector('img');
    expect(thumbnail?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  });

  it('sends it as a picture', async () => {
    const user = userEvent.setup();
    const { onsend, textarea, filePicker } = renderInput();
    await user.upload(filePicker, png());
    await attachedNamed('shot.png');

    await user.type(textarea, 'what is this?{Enter}');

    expect(onsend).toHaveBeenCalledWith('what is this?', [
      expect.objectContaining({ type: 'imageFile', name: 'shot.png' }),
    ]);
  });

  it('reads an SVG as text instead', async () => {
    const user = userEvent.setup();
    const { onsend, textarea, filePicker } = renderInput();
    const svg = new File(['<svg><rect /></svg>'], 'chart.svg', {
      type: 'image/svg+xml',
    });
    await user.upload(filePicker, svg);
    await attachedNamed('chart.svg');

    await user.type(textarea, 'what does this draw?{Enter}');

    // Most vision models cannot decode an SVG data URL; the markup says what
    // it draws.
    expect(onsend).toHaveBeenCalledWith('what does this draw?', [
      { type: 'textFile', name: 'chart.svg', content: '<svg><rect /></svg>' },
    ]);
  });

  it('takes one pasted from the clipboard', async () => {
    const { container, textarea } = renderInput();
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { files: [png()], getData: () => '' },
    });

    textarea.dispatchEvent(event);

    // Pasting a screenshot is how most people would put one in a message.
    await attachedNamed('shot.png');
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('leaves a plain text paste alone', async () => {
    const user = userEvent.setup();
    const { textarea } = renderInput();

    await user.click(textarea);
    await user.paste('a short quote');

    expect(textarea).toHaveValue('a short quote');
  });
});

describe('attachments outliving the page', () => {
  const textFile = () =>
    new File(['the contents'], 'notes.txt', { type: 'text/plain' });

  it('are waiting when the conversation is opened again', async () => {
    const user = userEvent.setup();
    const first = renderInput();
    await user.upload(first.filePicker, textFile());
    first.unmount();

    renderInput();

    // Going to the settings to change the model and coming back is the usual
    // way to lose them.
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
  });

  it('stay with the conversation they were made for', async () => {
    const user = userEvent.setup();
    const first = renderInput();
    await user.upload(first.filePicker, textFile());
    first.unmount();

    render(ChatInput, { props: { convId: 'conv-2', onsend: vi.fn() } });

    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
  });

  it('are gone once they have been sent', async () => {
    const user = userEvent.setup();
    const first = renderInput();
    await user.upload(first.filePicker, textFile());
    await user.type(first.textarea, 'a question{Enter}');
    first.unmount();

    renderInput();

    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
  });

  it('are gone once they have been taken off', async () => {
    const user = userEvent.setup();
    const first = renderInput();
    await user.upload(first.filePicker, textFile());
    await user.click(screen.getByRole('button', { name: 'Remove file' }));
    first.unmount();

    renderInput();

    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
  });

  it('do not take a name already in use when one is added', async () => {
    const user = userEvent.setup();
    const first = renderInput();
    await user.upload(first.filePicker, textFile());
    first.unmount();

    const second = renderInput();
    await user.upload(second.filePicker, textFile());

    // Ids carry on from what was already there; restarting at one would give
    // two attachments the same key and crash the render.
    expect(screen.getAllByText('notes.txt')).toHaveLength(2);
  });
});
