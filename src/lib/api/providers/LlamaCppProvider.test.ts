import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlamaCppProvider, parseLlamaCppModelName } from './LlamaCppProvider';

describe('naming a llama.cpp model', () => {
  it.each([
    // The point of the function: drop the quantization tag and extension.
    ['models/llama-3-8b.Q4_K_M.gguf', 'llama-3-8b'],
    ['C:\\models\\mistral-7b.Q5_K_S.gguf', 'mistral-7b'],
    ['Meta-Llama-3-8B-Instruct.Q4_K_M.gguf', 'Meta-Llama-3-8B-Instruct'],
    ['Llama-3.2-3B-Instruct-Q8_0.gguf', 'Llama-3.2-3B-Instruct'],
    ['qwen2.5-coder-7b-instruct-q4_0.gguf', 'qwen2.5-coder-7b-instruct'],
    ['model-IQ3_XS.gguf', 'model'],
    ['ggml-model-q4_0.bin', 'ggml-model'],
    ['phi-3-mini-4k-instruct-fp16.gguf', 'phi-3-mini-4k-instruct'],
  ])('strips the quantization and extension from %s', (input, expected) => {
    expect(parseLlamaCppModelName(input)).toBe(expected);
  });

  it.each([
    // A size is part of the name, not a suffix to discard.
    ['/home/user/llama-7b', 'llama-7b'],
    ['llama-3-8b', 'llama-3-8b'],
    ['gpt-4o', 'gpt-4o'],
    ['unknown-model', 'unknown-model'],
  ])('keeps the whole name of %s', (input, expected) => {
    expect(parseLlamaCppModelName(input)).toBe(expected);
  });

  it('falls back to the original when there is no filename', () => {
    expect(parseLlamaCppModelName('models/')).toBe('models/');
    expect(parseLlamaCppModelName('')).toBe('');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function rejectWith(name: string, message = 'boom') {
  const err = new Error(message);
  err.name = name;
  return vi.fn().mockRejectedValue(err);
}

const provider = () => LlamaCppProvider.new('http://localhost:8080');

describe('reporting why the server properties could not be read', () => {
  it('says so when the server did not answer in time', async () => {
    vi.stubGlobal('fetch', rejectWith('TimeoutError'));

    // This used to fall through to a placeholder 444 response and report
    // "Server closed connection without response" for every kind of failure.
    await expect(provider().getModels()).rejects.toThrow(/Timed out/);
  });

  it('says so when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', rejectWith('TypeError', 'Failed to fetch'));

    await expect(provider().getModels()).rejects.toThrow(/Cannot reach/);
  });

  it('allows a self-hosted server longer than a second', async () => {
    vi.stubGlobal('fetch', rejectWith('TimeoutError'));
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await expect(provider().getModels()).rejects.toThrow();

    expect(timeout.mock.calls[0][0]).toBeGreaterThanOrEqual(5000);
    timeout.mockRestore();
  });
});
