import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CONFIG_DEFAULT from '../config/config-default.json';
import type { Configuration } from '../types';
import { tts } from './tts.svelte';

interface FakeUtterance {
  text: string;
  pitch: number;
  rate: number;
  volume: number;
  voice: SpeechSynthesisVoice | null;
  onend?: () => void;
  onerror?: () => void;
}

let spoken: FakeUtterance[] = [];
let cancels = 0;
let voices: { name: string; lang?: string }[] = [];
let voicesChangedListeners: (() => void)[] = [];

/** jsdom implements neither half of the Web Speech API. */
function stubSpeechSynthesis() {
  spoken = [];
  cancels = 0;
  voices = [];
  voicesChangedListeners = [];

  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      pitch = 1;
      rate = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      constructor(public text: string) {}
    }
  );
  vi.stubGlobal('speechSynthesis', {
    speak: (u: FakeUtterance) => spoken.push(u),
    cancel: () => cancels++,
    getVoices: () => voices,
    addEventListener: (name: string, fn: () => void) => {
      if (name === 'voiceschanged') voicesChangedListeners.push(fn);
    },
  });
}

const config = (overrides: Partial<Configuration> = {}) =>
  ({ ...CONFIG_DEFAULT, ...overrides }) as unknown as Configuration;

beforeEach(() => {
  stubSpeechSynthesis();
  tts.stop();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading a message aloud', () => {
  it('speaks the text and marks the message as playing', () => {
    tts.speak(7, 'the quick brown fox', config());

    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe('the quick brown fox');
    expect(tts.isSpeaking(7)).toBe(true);
  });

  it('applies the voice settings', () => {
    tts.speak(
      7,
      'hello',
      config({ ttsPitch: 1.5, ttsRate: 0.5, ttsVolume: 0.25 })
    );

    // These three sliders existed in the settings while nothing read them.
    expect(spoken[0].pitch).toBe(1.5);
    expect(spoken[0].rate).toBe(0.5);
    expect(spoken[0].volume).toBe(0.25);
  });

  it('uses the chosen voice when the browser offers it', () => {
    voices = [{ name: 'Kyoko' }, { name: 'Daniel' }];

    tts.speak(7, 'hello', config({ ttsVoice: 'Daniel' }));

    expect(spoken[0].voice).toEqual({ name: 'Daniel' });
  });

  it('falls back to the default voice when it does not', () => {
    voices = [{ name: 'Kyoko' }];

    tts.speak(7, 'hello', config({ ttsVoice: 'A Voice From Another Machine' }));

    expect(spoken[0].voice).toBeNull();
  });

  it('says nothing for an empty message', () => {
    tts.speak(7, '   ', config());

    expect(spoken).toHaveLength(0);
    expect(tts.isSpeaking(7)).toBe(false);
  });
});

describe('only one message at a time', () => {
  it('stops the previous message before starting another', () => {
    tts.speak(1, 'first', config());
    tts.speak(2, 'second', config());

    expect(cancels).toBeGreaterThan(0);
    expect(tts.isSpeaking(1)).toBe(false);
    expect(tts.isSpeaking(2)).toBe(true);
  });

  it('ignores the interrupted message ending afterwards', () => {
    tts.speak(1, 'first', config());
    const first = spoken[0];
    tts.speak(2, 'second', config());

    // cancel() ends the first utterance, which fires its handler late; it must
    // not clear the marker belonging to the message now playing.
    first.onend?.();

    expect(tts.isSpeaking(2)).toBe(true);
  });
});

describe('finishing', () => {
  it('clears the marker when the message has been read', () => {
    tts.speak(7, 'hello', config());

    spoken[0].onend?.();

    expect(tts.isSpeaking(7)).toBe(false);
  });

  it('clears it when speech fails', () => {
    tts.speak(7, 'hello', config());

    // Otherwise the button offers to stop something that is not playing.
    spoken[0].onerror?.();

    expect(tts.isSpeaking(7)).toBe(false);
  });

  it('clears it when stopped', () => {
    tts.speak(7, 'hello', config());

    tts.stop();

    expect(tts.isSpeaking(7)).toBe(false);
    expect(cancels).toBeGreaterThan(0);
  });
});

/**
 * A module of its own. Subscribing to voiceschanged is deliberately done once
 * per page, which is a fact the module remembers — so a test that wants to
 * observe the subscription has to start from a module that has not yet made
 * one.
 */
async function freshTts() {
  vi.resetModules();
  return (await import('./tts.svelte')).tts;
}

describe('the voices the browser offers', () => {
  it('picks up the ones already loaded', async () => {
    voices = [{ name: 'Kyoko', lang: 'ja-JP' }];
    const fresh = await freshTts();

    fresh.loadVoices();

    expect(fresh.voices.map((v) => v.name)).toEqual(['Kyoko']);
  });

  it('picks up the ones that arrive late', async () => {
    // Browsers routinely answer the first getVoices() with nothing and fill
    // the list in afterwards, so a picker that asks once shows an empty list.
    const fresh = await freshTts();
    fresh.loadVoices();
    expect(fresh.voices).toHaveLength(0);

    voices = [
      { name: 'Kyoko', lang: 'ja-JP' },
      { name: 'Daniel', lang: 'en-GB' },
    ];
    voicesChangedListeners.forEach((fn) => fn());

    expect(fresh.voices).toHaveLength(2);
  });

  it('subscribes once however often it is asked', async () => {
    const fresh = await freshTts();

    fresh.loadVoices();
    fresh.loadVoices();
    fresh.loadVoices();

    expect(voicesChangedListeners).toHaveLength(1);
  });
});

describe('previewing a voice', () => {
  it('speaks the sample and reports itself as playing', () => {
    tts.preview('This is a demo.', config());

    expect(spoken.map((u) => u.text)).toEqual(['This is a demo.']);
    expect(tts.isPreviewing()).toBe(true);
  });

  it('is not mistaken for a message being read', () => {
    tts.preview('This is a demo.', config());

    // Message ids are timestamps, so nothing real can collide with the
    // sentinel the preview uses.
    expect(tts.isSpeaking(-1)).toBe(true);
    expect(tts.isPreviewing()).toBe(true);
  });

  it('stops being a preview once a message is read', () => {
    tts.preview('This is a demo.', config());

    tts.speak(7, 'the reply', config());

    expect(tts.isPreviewing()).toBe(false);
    expect(tts.isSpeaking(7)).toBe(true);
  });
});
