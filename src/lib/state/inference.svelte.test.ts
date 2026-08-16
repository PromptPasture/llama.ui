import { beforeEach, describe, expect, it, vi } from 'vitest';
import CONFIG_DEFAULT from '../config/config-default.json';
import type { Configuration } from '../types';

const mocks = vi.hoisted(() => ({
  getModels: vi.fn(),
  getInferenceProvider: vi.fn(),
}));

vi.mock('$lib/api/providers', () => ({
  getInferenceProvider: mocks.getInferenceProvider,
}));

const { inference } = await import('./inference.svelte');

const config = (overrides: Partial<Configuration> = {}) =>
  ({ ...CONFIG_DEFAULT, ...overrides }) as Configuration;

const MODELS = [
  { id: 'llama-3', name: 'Llama 3' },
  { id: 'mistral', name: 'Mistral' },
];

beforeEach(() => {
  mocks.getModels.mockResolvedValue(MODELS);
  mocks.getInferenceProvider.mockReturnValue({ getModels: mocks.getModels });
});

/** A configuration pointing at a reachable provider. */
const ready = (overrides: Partial<Configuration> = {}) =>
  config({
    provider: 'llama-cpp',
    baseUrl: 'http://localhost:8080',
    ...overrides,
  });

describe('bringing a provider up', () => {
  it('builds one and lists its models', async () => {
    await inference.initialize(ready());

    expect(inference.provider).not.toBeNull();
    expect(inference.models).toEqual(MODELS);
  });

  it('selects the configured model', async () => {
    await inference.initialize(ready({ model: 'mistral' }));

    expect(inference.selectedModel).toMatchObject({ id: 'mistral' });
  });

  it('selects nothing when the configured model is not offered', async () => {
    await inference.initialize(ready({ model: 'a-model-that-left' }));

    expect(inference.selectedModel).toBeNull();
  });

  it('selects nothing when no model is configured', async () => {
    await inference.initialize(ready({ model: '' }));

    expect(inference.selectedModel).toBeNull();
  });
});

describe('when the provider is no longer usable', () => {
  it('drops the models once the base url is cleared', async () => {
    await inference.initialize(ready({ model: 'llama-3' }));
    expect(inference.models).toHaveLength(2);

    await inference.initialize(ready({ baseUrl: '' }));

    // Leaving them behind offers a picker full of models nothing can serve.
    expect(inference.models).toEqual([]);
    expect(inference.provider).toBeNull();
  });

  it('drops the selection along with them', async () => {
    await inference.initialize(ready({ model: 'llama-3' }));
    expect(inference.selectedModel).not.toBeNull();

    await inference.initialize(ready({ baseUrl: '', model: 'llama-3' }));

    // Replies used to keep being labelled with a model from the provider the
    // user had already moved away from.
    expect(inference.selectedModel).toBeNull();
  });

  it('drops the selection after switching to a provider without it', async () => {
    await inference.initialize(ready({ model: 'llama-3' }));

    mocks.getModels.mockResolvedValue([{ id: 'gpt-4o', name: 'GPT-4o' }]);
    await inference.initialize(
      ready({ baseUrl: 'https://api.example.com', model: 'llama-3' })
    );

    expect(inference.selectedModel).toBeNull();
    expect(inference.models).toEqual([{ id: 'gpt-4o', name: 'GPT-4o' }]);
  });

  it('reports no models when the server cannot be reached', async () => {
    mocks.getModels.mockRejectedValue(new Error('unreachable'));

    await inference.initialize(ready({ model: 'llama-3' }));

    expect(inference.models).toEqual([]);
    expect(inference.selectedModel).toBeNull();
  });
});

describe('choosing a model when the configuration names none', () => {
  it('suggests the first the server offers', async () => {
    await inference.initialize(ready({ model: '' }));

    // A fresh configuration names no model, so without this the picker stays
    // blank and every send is refused for want of a model to send to.
    expect(inference.modelToAdopt(ready({ model: '' }))).toBe('llama-3');
  });

  it('leaves a working choice alone', async () => {
    await inference.initialize(ready({ model: 'mistral' }));

    expect(inference.modelToAdopt(ready({ model: 'mistral' }))).toBeNull();
  });

  it('replaces one the server no longer offers', async () => {
    await inference.initialize(ready({ model: 'a-model-that-left' }));

    // Moving to another provider otherwise leaves a name behind that nothing
    // there answers to.
    expect(inference.modelToAdopt(ready({ model: 'a-model-that-left' }))).toBe(
      'llama-3'
    );
  });

  it('suggests nothing when the server offers nothing', async () => {
    mocks.getModels.mockResolvedValue([]);
    await inference.initialize(ready({ model: '' }));

    // A server that is down or misconfigured should not have its emptiness
    // written into the configuration.
    expect(inference.modelToAdopt(ready({ model: '' }))).toBeNull();
  });

  it('suggests nothing when there is no provider at all', async () => {
    await inference.initialize(config({ baseUrl: '', model: '' }));

    expect(inference.modelToAdopt(config({ model: '' }))).toBeNull();
  });
});
