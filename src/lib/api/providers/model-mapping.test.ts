import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleProvider } from './GoogleProvider';
import { GroqProvider } from './GroqProvider';
import { MistralProvider } from './MistralProvider';
import type { InferenceApiModel } from '../../types';

/**
 * A model list is read from whatever the provider sends. Every mapping below
 * used to reach into a field it assumed was there, so a single entry missing
 * one either threw — losing the entire list — or produced a model with no name
 * for the picker to show.
 */
function listing(models: unknown[]) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: models, models }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

const list = (
  provider: { getModels: () => Promise<InferenceApiModel[]> },
  models: unknown[]
) => {
  vi.stubGlobal('fetch', listing(models));
  return provider.getModels();
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a Mistral model that lists no capabilities', () => {
  const mistral = () => MistralProvider.new('https://api.mistral.ai', 'k');

  it('is kept, with no modalities claimed for it', async () => {
    const [model] = await list(mistral(), [
      { id: 'mistral-small', name: 'Mistral Small' },
    ]);

    expect(model.id).toBe('mistral-small');
    expect(model.modalities).toEqual([]);
  });

  it('does not take the rest of the list with it', async () => {
    const models = await list(mistral(), [
      { id: 'no-capabilities' },
      {
        id: 'full',
        name: 'Full',
        capabilities: { completion_chat: true, vision: true },
      },
    ]);

    expect(models.map((m) => m.id).sort()).toEqual(['full', 'no-capabilities']);
  });

  it('is named by its id when it has no name', async () => {
    const [model] = await list(mistral(), [{ id: 'mistral-small' }]);

    expect(model.name).toBe('mistral-small');
  });
});

describe('a Google model that omits its display name', () => {
  it('is named by its id rather than by nothing', async () => {
    const models = await list(
      GoogleProvider.new('https://generativelanguage.googleapis.com', 'k'),
      [{ id: 'gemini-pro' }, { id: 'gemini-flash', display_name: 'Flash' }]
    );

    // A model with no name shows in the picker as a blank line.
    expect(models.find((m) => m.id === 'gemini-pro')?.name).toBe('gemini-pro');
    expect(models.find((m) => m.id === 'gemini-flash')?.name).toBe('Flash');
  });
});

describe('a Groq model with no stated owner', () => {
  it('is named by its id, not by the word undefined', async () => {
    const models = await list(GroqProvider.new('https://api.groq.com', 'k'), [
      { id: 'llama-3', created: 1 },
      { id: 'mixtral', owned_by: 'Mistral', created: 1 },
    ]);

    expect(models.find((m) => m.id === 'llama-3')?.name).toBe('llama-3');
    expect(models.find((m) => m.id === 'mixtral')?.name).toBe(
      'Mistral: mixtral'
    );
  });
});
