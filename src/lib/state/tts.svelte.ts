import type { Configuration } from '$lib/types';

interface TtsState {
  /** The message being read aloud, or null when nothing is. */
  speakingId: number | null;
  voices: SpeechSynthesisVoice[];
}

const state = $state<TtsState>({ speakingId: null, voices: [] });

/** Previewing a voice in the settings, where there is no message to read. */
const PREVIEW_ID = -1;

let listening = false;

/**
 * Reading a reply aloud. The browser allows one utterance queue per page, so
 * this keeps a single "who is speaking" marker rather than per-message state:
 * starting one reply necessarily stops another.
 */
export const tts = {
  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },

  isSpeaking(id: number): boolean {
    return state.speakingId === id;
  },

  /** The voices the browser offers, empty until it has loaded them. */
  get voices(): SpeechSynthesisVoice[] {
    return state.voices;
  },

  /**
   * Starts tracking the available voices. Browsers commonly answer the first
   * getVoices() with an empty list and fill it in later, announcing the change
   * — so asking once, as a picker rendering for the first time does, tends to
   * come back with nothing.
   */
  loadVoices(): void {
    if (!tts.supported) return;
    state.voices = window.speechSynthesis.getVoices();
    if (listening) return;
    listening = true;
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
      state.voices = window.speechSynthesis.getVoices();
    });
  },

  speak(id: number, text: string, config: Configuration): void {
    if (!tts.supported || !text.trim()) return;

    // Whatever was playing has to end first; the queue is shared. This also
    // fires the previous utterance's onend, which is why that handler checks
    // that it is still the one speaking before clearing the marker.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = config.ttsPitch;
    utterance.rate = config.ttsRate;
    utterance.volume = config.ttsVolume;

    // Read straight from the browser rather than the tracked list, so speaking
    // works on a page that never opened the settings.
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.name === config.ttsVoice);
    if (voice) utterance.voice = voice;

    const release = () => {
      if (state.speakingId === id) state.speakingId = null;
    };
    utterance.onend = release;
    // Without this a failed utterance would leave the button showing Stop
    // forever, with nothing to stop.
    utterance.onerror = release;

    state.speakingId = id;
    window.speechSynthesis.speak(utterance);
  },

  /** Speaks a sample so a voice can be judged before it is chosen. */
  preview(text: string, config: Configuration): void {
    tts.speak(PREVIEW_ID, text, config);
  },

  isPreviewing(): boolean {
    return state.speakingId === PREVIEW_ID;
  },

  stop(): void {
    if (tts.supported) window.speechSynthesis.cancel();
    state.speakingId = null;
  },
};
