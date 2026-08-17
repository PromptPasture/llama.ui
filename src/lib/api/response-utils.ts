/**
 * How long to wait for an inference server. A second suits a server on
 * localhost, but most of the providers shipped with the app are hosted, where
 * a round trip past a second is ordinary. The calls are made in the
 * background, so the extra patience is not felt.
 */
export const PROVIDER_TIMEOUT_MS = 10_000;

/**
 * Turns a failed fetch into an error that says what went wrong.
 *
 * The reason used to be discarded and the request left to fall through to a
 * placeholder 444 response, so a timeout, a DNS failure, a refused connection
 * and a CORS rejection were all reported as "Server closed connection without
 * response" — a description of none of them.
 *
 * A deliberate cancellation is passed through untouched: chat state recognises
 * generation being stopped by the AbortError name, and wrapping it would turn
 * stopping into a failure.
 *
 * @param error - Whatever fetch rejected with.
 * @returns The error to throw.
 */
export function describeNetworkFailure(error: unknown): Error {
  const name = (error as Error)?.name;
  if (name === 'AbortError') return error as Error;
  if (name === 'TimeoutError') {
    return new Error('Timed out: the inference server did not respond in time');
  }
  return new Error(
    `Cannot reach the inference server: ${(error as Error)?.message ?? 'network error'}`
  );
}

/**
 * The reason a server gave, wherever it put it.
 *
 * OpenAI nests it as `error.message`; llama.cpp and LM Studio answer with
 * `error` as a plain string. Reading only the nested form left the reader with
 * "Unknown error" while the server had said exactly what was wrong.
 *
 * @param body - A parsed response body, or a streamed chunk
 * @returns What it said, or an empty string if it said nothing
 */
export function errorDetail(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const record = body as Record<string, unknown>;
  const error = record.error;
  const candidate =
    typeof error === 'string'
      ? error
      : typeof (error as Record<string, unknown>)?.message === 'string'
        ? (error as Record<string, unknown>).message
        : record.message;
  return typeof candidate === 'string' ? candidate.trim() : '';
}
