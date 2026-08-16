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

  /**
   * The model to adopt when the configured one cannot be used.
   *
   * Nothing ever chose one: a fresh configuration names no model, so pointing
   * the app at a server loaded its models, left the picker blank, and failed
   * every send for want of a model to send to. The same happens after moving
   * to a provider that does not have the one previously chosen.
   *
   * @param config The current configuration
   * @returns The model id to adopt, or null to leave the choice alone
   */
  modelToAdopt(config: Configuration): string | null {
    if (state.models.length === 0) return null;
    const chosen = config.model;
    if (chosen && state.models.some((m) => m.id === chosen)) return null;
    return state.models[0].id;
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
