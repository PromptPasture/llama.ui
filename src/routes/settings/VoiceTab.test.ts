import { render, screen } from '@testing-library/svelte';
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
import CONFIG_DEFAULT from '$lib/config/config-default.json';
import type { Configuration } from '$lib/types';

const { default: VoiceTab } = await import('./VoiceTab.svelte');
const { tts } = await import('$lib/state/tts.svelte');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  register('ru', () => import('$lib/i18n/ru.json'));
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

let spoken: { text: string; voice: { name: string } | null }[] = [];
let voices: { name: string; lang: string }[] = [];

/** jsdom implements neither half of the Web Speech API. */
function stubSpeechSynthesis() {
  spoken = [];
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      pitch = 1;
      rate = 1;
      volume = 1;
      voice: { name: string } | null = null;
      constructor(public text: string) {}
    }
  );
  vi.stubGlobal('speechSynthesis', {
    speak: (u: (typeof spoken)[number]) => spoken.push(u),
    cancel: () => {},
    getVoices: () => voices,
    addEventListener: () => {},
  });
}

beforeEach(() => {
  voices = [
    { name: 'Kyoko', lang: 'ja-JP' },
    { name: 'Daniel', lang: 'en-GB' },
  ];
  stubSpeechSynthesis();
});

afterEach(() => {
  tts.stop();
  vi.unstubAllGlobals();
});

function renderTab(overrides: Partial<Configuration> = {}) {
  const onchange = vi.fn(() => vi.fn());
  render(VoiceTab, {
    props: {
      config: { ...CONFIG_DEFAULT, ...overrides } as unknown as Configuration,
      onchange,
    },
  });
  return { onchange };
}

describe('choosing a voice', () => {
  it('offers the voices the browser has', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: /Voice/i }));

    expect(screen.getByText('Kyoko (ja-JP)')).toBeInTheDocument();
    expect(screen.getByText('Daniel (en-GB)')).toBeInTheDocument();
  });

  it('names the stored default rather than showing nothing', () => {
    // ttsVoice defaults to an empty string; with no entry for it the field
    // reads blank, the way the theme and language fields used to.
    renderTab();

    expect(
      screen.getByRole('button', { name: /Voice/i }).textContent
    ).toContain('System default');
  });
});

describe('checking how a voice sounds', () => {
  it('speaks the sample', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(spoken.map((u) => u.text)).toEqual([
      'This is a demo of Web Speech Synthesis.',
    ]);
  });

  it('uses the settings being edited, not the saved ones', async () => {
    const user = userEvent.setup();
    // The point of the button is judging a change before committing to it.
    renderTab({ ttsVoice: 'Kyoko' });

    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(spoken[0].voice).toEqual({ name: 'Kyoko', lang: 'ja-JP' });
  });

  it('turns into a stop button while it plays', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Check' }));

    expect(
      await screen.findByRole('button', { name: 'Stop' })
    ).toBeInTheDocument();
  });
});

describe('the wording of the voice choices', () => {
  afterEach(async () => {
    await locale.set('en');
    await waitLocale();
  });

  it('names the stored default in the language being read', async () => {
    await locale.set('ru');
    await waitLocale();
    const { container } = render(VoiceTab, {
      props: {
        config: CONFIG_DEFAULT as unknown as Configuration,
        onchange: vi.fn(() => vi.fn()),
      },
    });

    // Hardcoded, this entry stayed English inside a translated screen.
    const field = container.querySelector('.settings-dropdown');
    expect(field?.textContent).toContain('Системный по умолчанию');
  });
});
