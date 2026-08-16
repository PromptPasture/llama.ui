import type { Configuration } from '$lib/types';

interface TtsState {
  /** The message being read aloud, or null when nothing is. */
  speakingId: number | null;
}

const state = $state<TtsState>({ speakingId: null });

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
  voices(): SpeechSynthesisVoice[] {
    return tts.supported ? window.speechSynthesis.getVoices() : [];
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

    const voice = tts.voices().find((v) => v.name === config.ttsVoice);
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

  stop(): void {
    if (tts.supported) window.speechSynthesis.cancel();
    state.speakingId = null;
  },
};
