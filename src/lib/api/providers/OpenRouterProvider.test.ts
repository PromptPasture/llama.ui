import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterProvider } from './OpenRouterProvider';

function listing(data: unknown[]) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

const model = (over: Record<string, unknown> = {}) => ({
  id: 'vendor/model',
  name: 'Vendor Model',
  created: 2,
  description: 'A model.',
  architecture: {
    input_modalities: ['text', 'image'],
    output_modalities: ['text'],
  },
  ...over,
});

const listModels = (data: unknown[]) => {
  vi.stubGlobal('fetch', listing(data));
  return OpenRouterProvider.new('https://openrouter.ai/api', 'key').getModels();
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reading the OpenRouter model list', () => {
  it('carries across what a model says about itself', async () => {
    const [m] = await listModels([model()]);

    expect(m).toMatchObject({
      id: 'vendor/model',
      name: 'Vendor Model',
      modalities: ['text', 'image'],
      output_modalities: ['text'],
    });
  });

  it('keeps a model that does not describe its architecture', async () => {
    // Reading it unguarded threw, and the throw came out of the whole fetch:
    // one odd entry among hundreds and the provider listed nothing at all.
    const [m] = await listModels([model({ architecture: undefined })]);

    expect(m.id).toBe('vendor/model');
    expect(m.modalities).toEqual([]);
    expect(m.output_modalities).toEqual([]);
  });

  it('keeps the rest of the list when one entry is odd', async () => {
    const models = await listModels([
      model({ architecture: undefined }),
      model({ id: 'other/model', name: 'Other Model' }),
    ]);

    expect(models.map((m) => m.id).sort()).toEqual([
      'other/model',
      'vendor/model',
    ]);
  });

  it('names a model by its id when it has no name', async () => {
    const [m] = await listModels([model({ name: undefined })]);

    // The base mapping already did this; the override forgot to.
    expect(m.name).toBe('vendor/model');
  });
});
