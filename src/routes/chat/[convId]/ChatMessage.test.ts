import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Message, MessageDisplay } from '$lib/types';

const mocks = vi.hoisted(() => ({
  showConfirm: vi.fn().mockResolvedValue(false),
  deleteMessage: vi.fn(),
  branchMessage: vi.fn(),
  copyStr: vi.fn(),
}));

vi.mock('$lib/state/modal.svelte', () => ({
  modal: { showConfirm: mocks.showConfirm },
}));
vi.mock('$lib/state/chat.svelte', () => ({
  chat: { branchMessage: mocks.branchMessage },
}));
vi.mock('$lib/database/indexedDB', () => ({
  default: { deleteMessage: mocks.deleteMessage },
}));
vi.mock('$lib/utils/dom-helpers', () => ({ copyStr: mocks.copyStr }));

const { default: ChatMessage } = await import('./ChatMessage.svelte');
const { app } = await import('$lib/state/app.svelte');

// Set the locale explicitly rather than through initI18n(), which picks its
// initial locale from navigator.language and is not deterministic here.
beforeAll(async () => {
  register('en', () => import('../../../lib/i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 2,
    convId: 'conv-1',
    type: 'text',
    timestamp: 1700000000000,
    role: 'assistant',
    content: 'the reply',
    parent: 1,
    children: [],
    ...overrides,
  };
}

function display(overrides: Partial<MessageDisplay> = {}): MessageDisplay {
  return {
    msg: message(),
    siblingLeafNodeIds: [2],
    siblingCurrIdx: 0,
    ...overrides,
  };
}

function renderMessage(display_: MessageDisplay = display()) {
  const handlers = {
    onregeneratefn: vi.fn(),
    onedituserfn: vi.fn(),
    oneditassistantfn: vi.fn(),
    onchangesibling: vi.fn(),
  };
  const rendered = render(ChatMessage, {
    props: { message: display_, ...handlers },
  });
  return { ...rendered, ...handlers };
}

describe('ChatMessage roles', () => {
  it('labels an assistant message', () => {
    renderMessage();
    expect(
      screen.getByRole('group', { name: 'Message from assistant' })
    ).toBeInTheDocument();
  });

  it('labels a user message', () => {
    renderMessage(display({ msg: message({ role: 'user' }) }));
    expect(
      screen.getByRole('group', { name: 'Message from user' })
    ).toBeInTheDocument();
  });

  it('offers regeneration only for assistant messages', () => {
    renderMessage();
    expect(
      screen.getByRole('button', { name: 'Regenerate response' })
    ).toBeInTheDocument();
  });

  it('does not offer regeneration for user messages', () => {
    renderMessage(display({ msg: message({ role: 'user' }) }));
    expect(
      screen.queryByRole('button', { name: 'Regenerate response' })
    ).not.toBeInTheDocument();
  });
});

describe('ChatMessage tooltips', () => {
  it('gives every icon-only action a hover tooltip', () => {
    renderMessage(display({ siblingLeafNodeIds: [2, 4], siblingCurrIdx: 0 }));

    const expected: Record<string, string> = {
      'Switch to the previous message version': 'Previous',
      'Switch to the next message version': 'Next',
      'Regenerate response': 'Regenerate',
      'Edit message': 'Edit',
      'Copy content': 'Copy',
      'Delete message': 'Delete',
    };

    for (const [label, tooltip] of Object.entries(expected)) {
      expect(screen.getByRole('button', { name: label })).toHaveAttribute(
        'title',
        tooltip
      );
    }
  });
});

describe('ChatMessage branch switcher', () => {
  it('stays hidden when a message has no alternatives', () => {
    renderMessage();
    expect(
      screen.queryByRole('button', {
        name: 'Switch to the next message version',
      })
    ).not.toBeInTheDocument();
  });

  it('shows the position among versions', () => {
    renderMessage(
      display({ siblingLeafNodeIds: [2, 4, 6], siblingCurrIdx: 1 })
    );
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('moves to the neighbouring version', async () => {
    const user = userEvent.setup();
    const handlers = renderMessage(
      display({ siblingLeafNodeIds: [2, 4, 6], siblingCurrIdx: 1 })
    );

    await user.click(
      screen.getByRole('button', { name: 'Switch to the next message version' })
    );
    expect(handlers.onchangesibling).toHaveBeenCalledWith(6);

    await user.click(
      screen.getByRole('button', {
        name: 'Switch to the previous message version',
      })
    );
    expect(handlers.onchangesibling).toHaveBeenCalledWith(2);
  });

  it('disables the arrows at either end', () => {
    renderMessage(display({ siblingLeafNodeIds: [2, 4], siblingCurrIdx: 0 }));
    expect(
      screen.getByRole('button', {
        name: 'Switch to the previous message version',
      })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Switch to the next message version' })
    ).toBeEnabled();
  });
});

describe('ChatMessage editing', () => {
  it('opens an editor seeded with the message text', async () => {
    const user = userEvent.setup();
    renderMessage();

    await user.click(screen.getByRole('button', { name: 'Edit message' }));

    expect(screen.getByRole('textbox')).toHaveValue('the reply');
  });

  it('reports an edited assistant message', async () => {
    const user = userEvent.setup();
    const handlers = renderMessage();

    await user.click(screen.getByRole('button', { name: 'Edit message' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'corrected');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(handlers.oneditassistantfn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      'corrected'
    );
  });

  it('reports an edited user message through the user handler', async () => {
    const user = userEvent.setup();
    const handlers = renderMessage(display({ msg: message({ role: 'user' }) }));

    await user.click(screen.getByRole('button', { name: 'Edit message' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'rephrased');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(handlers.onedituserfn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 }),
      'rephrased',
      []
    );
  });

  it('discards the edit on cancel, leaving the message shown', async () => {
    const user = userEvent.setup();
    const handlers = renderMessage();

    await user.click(screen.getByRole('button', { name: 'Edit message' }));
    await user.type(screen.getByRole('textbox'), ' extra');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(handlers.oneditassistantfn).not.toHaveBeenCalled();
  });

  it('hides the action buttons while editing', async () => {
    const user = userEvent.setup();
    renderMessage();

    await user.click(screen.getByRole('button', { name: 'Edit message' }));

    expect(
      screen.queryByRole('button', { name: 'Copy content' })
    ).not.toBeInTheDocument();
  });
});

describe('ChatMessage actions', () => {
  it('copies the message content', async () => {
    const user = userEvent.setup();
    renderMessage();

    await user.click(screen.getByRole('button', { name: 'Copy content' }));

    expect(mocks.copyStr).toHaveBeenCalledWith('the reply');
  });

  it('asks before deleting, and does nothing when declined', async () => {
    const user = userEvent.setup();
    mocks.showConfirm.mockResolvedValueOnce(false);
    renderMessage();

    await user.click(screen.getByRole('button', { name: 'Delete message' }));

    expect(mocks.showConfirm).toHaveBeenCalled();
    expect(mocks.deleteMessage).not.toHaveBeenCalled();
  });

  it('deletes once confirmed', async () => {
    const user = userEvent.setup();
    mocks.showConfirm.mockResolvedValueOnce(true);
    renderMessage();

    await user.click(screen.getByRole('button', { name: 'Delete message' }));

    expect(mocks.deleteMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2 })
    );
  });

  it('withholds the actions while a reply is still streaming', () => {
    renderMessage(display({ isPending: true }));
    expect(
      screen.queryByRole('button', { name: 'Copy content' })
    ).not.toBeInTheDocument();
  });
});

describe('ChatMessage read aloud', () => {
  let spoken: { text: string }[] = [];

  /** jsdom implements neither half of the Web Speech API. */
  function withSpeech() {
    spoken = [];
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        pitch = 1;
        rate = 1;
        volume = 1;
        voice = null;
        constructor(public text: string) {}
      }
    );
    vi.stubGlobal('speechSynthesis', {
      speak: (u: { text: string }) => spoken.push(u),
      cancel: () => {},
      getVoices: () => [],
    });
  }

  afterEach(async () => {
    const { tts } = await import('$lib/state/tts.svelte');
    tts.stop();
    vi.unstubAllGlobals();
  });

  it('reads the reply when asked', async () => {
    withSpeech();
    const user = userEvent.setup();
    renderMessage();

    await user.click(screen.getByRole('button', { name: 'Play message' }));

    expect(spoken.map((u) => u.text)).toEqual(['the reply']);
  });

  it('offers to stop once it is reading', async () => {
    withSpeech();
    const user = userEvent.setup();
    renderMessage();

    await user.click(screen.getByRole('button', { name: 'Play message' }));

    expect(
      await screen.findByRole('button', { name: 'Stop message' })
    ).toBeInTheDocument();
  });

  it('does not offer to read a message the user wrote', () => {
    withSpeech();
    renderMessage(display({ msg: message({ role: 'user' }) }));

    expect(
      screen.queryByRole('button', { name: 'Play message' })
    ).not.toBeInTheDocument();
  });

  it('stays out of the way where the browser cannot speak', () => {
    // No stub: jsdom has no speechSynthesis, standing in for a browser
    // without the Web Speech API.
    renderMessage();

    expect(
      screen.queryByRole('button', { name: 'Play message' })
    ).not.toBeInTheDocument();
  });
  it('reads the prose rather than the markdown', async () => {
    withSpeech();
    const user = userEvent.setup();
    renderMessage(
      display({ msg: message({ content: 'Some **bold** text.' }) })
    );

    await user.click(screen.getByRole('button', { name: 'Play message' }));

    expect(spoken[0].text).toBe('Some bold text.');
  });

  it('reads the answer without the reasoning that led to it', async () => {
    withSpeech();
    const user = userEvent.setup();
    renderMessage(
      display({
        msg: message({ content: '<think>weighing it up</think>It is four.' }),
      })
    );

    await user.click(screen.getByRole('button', { name: 'Play message' }));

    // The thinking is collapsed on screen; there is no reason to hear it.
    expect(spoken[0].text).toBe('It is four.');
  });
});

describe('ChatMessage performance figures', () => {
  const timings = {
    predicted_n: 120,
    predicted_ms: 2000,
    prompt_n: 45,
    prompt_ms: 100,
  };

  afterEach(() => {
    app.saveConfig({ ...app.config, showTokensPerSecond: false });
  });

  it('shows them when they have been asked for', () => {
    app.saveConfig({ ...app.config, showTokensPerSecond: true });
    renderMessage(display({ msg: message({ timings }) }));

    // Collected from every reply and stored with it, while the setting that
    // asks to see them did nothing at all.
    expect(screen.getByText(/60\.0 tok\/s/)).toBeInTheDocument();
  });

  it('keeps them out of the way otherwise', () => {
    renderMessage(display({ msg: message({ timings }) }));

    expect(screen.queryByText(/tok\/s/)).toBeNull();
  });

  it('says nothing for a reply that reported none', () => {
    app.saveConfig({ ...app.config, showTokensPerSecond: true });
    renderMessage(display({ msg: message() }));

    expect(screen.queryByText(/tok\/s/)).toBeNull();
    expect(screen.queryByText(/tokens/)).toBeNull();
  });
});

describe('ChatMessage announcing itself', () => {
  it('says which version of a message is being shown', () => {
    renderMessage(
      display({ siblingLeafNodeIds: [1, 2, 3], siblingCurrIdx: 1 })
    );

    // The counter reads '2 / 3' on the page, which on its own says nothing
    // about what is two of three.
    expect(
      screen.getByRole('navigation', { name: 'Message version 2 of 3' })
    ).toBeInTheDocument();
  });

  it('says the reasoning is folded away, and that it can be opened', async () => {
    renderMessage(
      display({ msg: message({ reasoning_content: 'weighing it up' }) })
    );

    const toggle = screen.getByRole('button', { name: /Reasoning/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('says so when it has been opened', async () => {
    const user = userEvent.setup();
    renderMessage(
      display({ msg: message({ reasoning_content: 'weighing it up' }) })
    );

    await user.click(screen.getByRole('button', { name: /Reasoning/ }));

    expect(screen.getByRole('button', { name: /Reasoning/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('names what the toggle opens, and ties the two together', async () => {
    const user = userEvent.setup();
    renderMessage(
      display({ msg: message({ reasoning_content: 'weighing it up' }) })
    );

    await user.click(screen.getByRole('button', { name: /Reasoning/ }));

    const region = screen.getByRole('region', {
      name: 'Thought process content',
    });
    expect(region).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reasoning/ })).toHaveAttribute(
      'aria-controls',
      region.id
    );
  });
});

describe('ChatMessage icons that point along the line of text', () => {
  /**
   * jsdom applies no stylesheet, so the mirroring itself cannot be seen here.
   * What is checked is that the icons carrying a direction are marked for it,
   * and app.css is checked separately for the rule that acts on the mark.
   */
  it('marks the arrows between versions of a message', () => {
    const { container } = renderMessage(
      display({ siblingLeafNodeIds: [1, 2, 3], siblingCurrIdx: 1 })
    );

    const nav = container.querySelector('.msg__siblings');
    expect(nav?.querySelectorAll('.rtl-flip')).toHaveLength(2);
  });

  it('marks the fold that opens the reasoning', () => {
    const { container } = renderMessage(
      display({ msg: message({ reasoning_content: 'weighing it up' }) })
    );

    // Closed, it points the way the text runs; open, it points down and needs
    // no mirroring.
    expect(container.querySelector('.msg__reasoning .rtl-flip')).not.toBeNull();
  });

  it('leaves the upright icons alone', () => {
    const { container } = renderMessage(
      display({ msg: message({ reasoning_content: 'weighing it up' }) })
    );
    const marked = container.querySelectorAll('.rtl-flip').length;

    // Only the ones that point left or right; a mirrored bin or pencil would
    // just look wrong.
    expect(marked).toBe(1);
  });
});
