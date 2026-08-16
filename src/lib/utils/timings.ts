import type { TimingReport } from '$lib/types';

/** Milliseconds below which a rate says more about the clock than the model. */
const MIN_MEASURABLE_MS = 1;

/**
 * A one-line summary of how a reply was produced.
 *
 * The numbers were already being collected from every reply and stored with
 * it; nothing ever showed them, so the setting that asks for them did nothing.
 *
 * Not every provider reports the same things. Servers that answer with OpenAI's
 * `usage` give token counts and no timings at all, so the rate is left out
 * rather than invented from a missing duration.
 *
 * @param timings - What the server reported about the reply
 * @returns The summary, or null when nothing worth saying was reported
 */
export function describeTimings(timings?: TimingReport): string | null {
  if (!timings) return null;

  const parts: string[] = [];
  const { predicted_n, predicted_ms, prompt_n } = timings;

  // A missing duration reads as zero and so falls short of measurable, which
  // is what should happen: no duration, no rate.
  if (predicted_n !== undefined && (predicted_ms ?? 0) >= MIN_MEASURABLE_MS) {
    const perSecond = (predicted_n / (predicted_ms as number)) * 1000;
    parts.push(`${perSecond.toFixed(1)} tok/s`);
  }

  if (predicted_n !== undefined) parts.push(`${predicted_n} tokens`);
  if (prompt_n !== undefined) parts.push(`${prompt_n} prompt`);

  return parts.length > 0 ? parts.join(' · ') : null;
}
