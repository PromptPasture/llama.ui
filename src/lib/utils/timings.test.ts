import { describe, expect, it } from 'vitest';
import { describeTimings } from './timings';

describe('summarising how a reply was produced', () => {
  it('reports the rate, the reply length and the prompt length', () => {
    const out = describeTimings({
      predicted_n: 120,
      predicted_ms: 2000,
      prompt_n: 45,
      prompt_ms: 100,
    });

    expect(out).toBe('60.0 tok/s · 120 tokens · 45 prompt');
  });

  it('leaves the rate out when no duration was reported', () => {
    // Servers answering with OpenAI's `usage` give counts and no timings, so
    // a rate here would be invented from a missing duration.
    expect(describeTimings({ predicted_n: 120, prompt_n: 45 })).toBe(
      '120 tokens · 45 prompt'
    );
  });

  it('leaves it out for a duration too short to measure', () => {
    expect(describeTimings({ predicted_n: 3, predicted_ms: 0 })).toBe(
      '3 tokens'
    );
  });

  it('says nothing when nothing was reported', () => {
    expect(describeTimings(undefined)).toBeNull();
    expect(describeTimings({})).toBeNull();
  });

  it('rounds the rate rather than printing every digit', () => {
    expect(describeTimings({ predicted_n: 100, predicted_ms: 3000 })).toContain(
      '33.3 tok/s'
    );
  });
});
