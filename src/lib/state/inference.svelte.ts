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

    if (!isProviderReady(config)) {
      // Clearing the base url leaves nothing to talk to, so the previous
      // provider's models must not stay in the picker.
      state.models = [];
    } else if (Object.is(prevConfig, CONFIG_DEFAULT) || !!config.baseUrl) {
      state.models = await inference.fetchModels(config, { silent: true });
    }

    // Always recomputed. Assigning only on a match left the model from the
    // previous provider selected after switching, and every reply generated
    // afterwards was labelled with its name.
    state.selectedModel = config.model
      ? (state.models.find((m) => m.id === config.model) ?? null)
      : null;

    _prevConfig = config;
  },
};
