import { getInferenceProvider } from '$lib/api/providers';
import { CONFIG_DEFAULT, INFERENCE_PROVIDERS } from '$lib/config';
import type {
  Configuration,
  InferenceApiModel,
  InferenceProvider,
} from '$lib/types';
import { deepEqual } from '$lib/utils/object-helpers';

interface InferenceState {
  provider: InferenceProvider | null;
  models: InferenceApiModel[];
  selectedModel: InferenceApiModel | null;
}

const state = $state<InferenceState>({
  provider: null,
  models: [],
  selectedModel: null,
});

let _prevConfig: Configuration | null = null;

function isProviderReady(config: Configuration): boolean {
  if (!config.provider) return false;
  const info = INFERENCE_PROVIDERS[config.provider];
  if (!info) return true;
  return !!config.baseUrl && (!info.isKeyRequired || config.apiKey !== '');
}

export const inference = {
  get provider() {
    return state.provider;
  },
  get models() {
    return state.models;
  },
  get selectedModel() {
    return state.selectedModel;
  },

  async fetchModels(
    config: Configuration,
    options: { silent?: boolean } = {}
  ): Promise<InferenceApiModel[]> {
    if (!isProviderReady(config)) return [];
    const provider = getInferenceProvider(
      config.provider,
      config.baseUrl,
      config.apiKey
    );
    try {
      return await provider.getModels();
    } catch (err) {
      if (!options.silent) console.error('fetch models failed:', err);
      return [];
    }
  },

  async initialize(config: Configuration): Promise<void> {
    const prevConfig = _prevConfig;

    if (!deepEqual(prevConfig, config)) {
      state.provider = isProviderReady(config)
        ? getInferenceProvider(config.provider, config.baseUrl, config.apiKey)
        : null;
    }

    if (Object.is(prevConfig, CONFIG_DEFAULT) || !!config.baseUrl) {
      if (isProviderReady(config)) {
        state.models = await inference.fetchModels(config, { silent: true });
      } else {
        state.models = [];
      }
    }

    if (config.model && state.models.length > 0) {
      state.selectedModel =
        state.models.find((m) => m.id === config.model) ?? null;
    }

    _prevConfig = config;
  },
};
