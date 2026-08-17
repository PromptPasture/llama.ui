import { describe, expect, it } from 'vitest';
import { getInferenceProvider, registerProvider } from './provider-factory';

/**
 * A base url of its own per test: the factory keeps a cache for the lifetime
 * of the page, so two tests sharing an address would share a provider.
 */
let next = 0;
const anAddress = () => `http://localhost:${8000 + next++}`;

describe('choosing which provider to talk to', () => {
  it('builds one for a known provider', () => {
    const provider = getInferenceProvider('llama-cpp', anAddress());

    expect(provider).toBeTruthy();
  });

  it('falls back to plain OpenAI for one it does not know', () => {
    // An unknown key is a configuration this version has not heard of, not a
    // reason to leave the app unable to send anything.
    const provider = getInferenceProvider('some-new-service', anAddress());

    expect(provider).toBeTruthy();
  });

  it('refuses without an address, rather than building something useless', () => {
    // Named, because without an address it fails later anyway and for a
    // reason that says nothing about the configuration.
    expect(() => getInferenceProvider('llama-cpp', '')).toThrow(/base url/i);
  });

  it('refuses even for a provider that would not check for itself', () => {
    // Every provider shipped here inherits a constructor that refuses an
    // empty address, so this is the one case the factory's own check covers:
    // registerProvider takes any factory at all.
    registerProvider('a-lenient-service', () => ({}) as never);

    expect(() => getInferenceProvider('a-lenient-service', '')).toThrow(
      /base url/i
    );
  });

  it('reuses the one it built for the same address and key', () => {
    const url = anAddress();

    const first = getInferenceProvider('llama-cpp', url, 'a-key');
    const second = getInferenceProvider('llama-cpp', url, 'a-key');

    // Rebuilding per call would throw away whatever the provider has learned
    // about the server between requests.
    expect(second).toBe(first);
  });

  it('builds a new one when the key changes', () => {
    const url = anAddress();
    const first = getInferenceProvider('llama-cpp', url, 'the-old-key');

    const second = getInferenceProvider('llama-cpp', url, 'the-new-key');

    // Handing back the cached one would keep authenticating with a key the
    // reader has already replaced.
    expect(second).not.toBe(first);
    expect(second.getApiKey()).toBe('the-new-key');
  });

  it('remembers the new one rather than rebuilding every time after', () => {
    const url = anAddress();
    getInferenceProvider('llama-cpp', url, 'the-old-key');
    const replaced = getInferenceProvider('llama-cpp', url, 'the-new-key');

    expect(getInferenceProvider('llama-cpp', url, 'the-new-key')).toBe(
      replaced
    );
  });

  it('keeps providers at different addresses apart', () => {
    const one = getInferenceProvider('llama-cpp', anAddress());
    const other = getInferenceProvider('llama-cpp', anAddress());

    expect(other).not.toBe(one);
  });

  it('keeps different providers at one address apart', () => {
    const url = anAddress();

    const llama = getInferenceProvider('llama-cpp', url);
    const openRouter = getInferenceProvider('open-router', url);

    // The same machine can speak more than one dialect; the cache is keyed by
    // both, and keying it by address alone would return the wrong one.
    expect(openRouter).not.toBe(llama);
  });

  it('takes an address with no key at all', () => {
    // A self-hosted server usually wants none.
    expect(getInferenceProvider('llama-cpp', anAddress()).getApiKey()).toBe('');
  });
});

describe('adding a provider this version does not ship', () => {
  it('uses the one that was registered', () => {
    const url = anAddress();
    const built = { registered: true } as never;
    registerProvider('a-made-up-service', () => built);

    expect(getInferenceProvider('a-made-up-service', url)).toBe(built);
  });
});
