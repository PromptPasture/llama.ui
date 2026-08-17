import { beforeEach, describe, expect, it } from 'vitest';
import LocalStorage from './localStorage';

beforeEach(() => {
  localStorage.clear();
});

/** Everything the app is known to keep outside the database. */
function storeSomethingUnder(keys: readonly string[]) {
  for (const key of keys) localStorage.setItem(key, 'something');
}

describe('forgetting everything kept outside the database', () => {
  it('forgets the configuration, and the api key in it', () => {
    localStorage.setItem('config', '{"apiKey":"sk-secret"}');

    LocalStorage.forgetEverything();

    // Deleting the conversations leaves the credential behind, which is the
    // part that matters when the machine changes hands.
    expect(localStorage.getItem('config')).toBeNull();
  });

  it('forgets a message that was typed and never sent', () => {
    localStorage.setItem('drafts', '{"conv-1":"half a thought"}');

    LocalStorage.forgetEverything();

    // An unsent message is as much the reader's as a sent one.
    expect(localStorage.getItem('drafts')).toBeNull();
  });

  it('forgets every key it knows about', () => {
    storeSomethingUnder(LocalStorage.KEYS);

    LocalStorage.forgetEverything();

    const left = LocalStorage.KEYS.filter(
      (key) => localStorage.getItem(key) !== null
    );
    expect(left).toEqual([]);
  });

  it('names the keys rather than emptying the origin', () => {
    storeSomethingUnder(LocalStorage.KEYS);
    localStorage.setItem('something-else-entirely', 'not ours');

    LocalStorage.forgetEverything();

    // The origin may hold what this app did not put there.
    expect(localStorage.getItem('something-else-entirely')).toBe('not ours');
  });

  it('has nothing to do when nothing was stored', () => {
    expect(() => LocalStorage.forgetEverything()).not.toThrow();
  });

  it('covers each key the app actually writes', () => {
    // Kept in step by hand, so the list is checked against the names the rest
    // of the app uses: a key added and not listed is a key left behind.
    expect([...LocalStorage.KEYS].sort()).toEqual([
      'config',
      'drafts',
      'language',
      'migratedToIDB',
      'theme',
    ]);
  });
});
