import { InferenceProviders } from '../types';
import inferenceProviders from './inference-providers.json';

/**
 * List of available inference providers
 * @constant
 * @type {Readonly<InferenceProviders>}
 * @description Immutable collection of inference providers loaded from inference-providers.json
 * @see InferenceProviders
 */
export const INFERENCE_PROVIDERS: Readonly<InferenceProviders> =
  Object.freeze(inferenceProviders);
