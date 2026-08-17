import type { InferenceApiModel } from '$lib/types';

/**
 * Whether a model can be sent a picture.
 *
 * Only a positive statement counts against it. Most providers say nothing
 * about what their models accept, and treating silence as a refusal would
 * refuse every picture on every provider but the three that report it.
 *
 * @param model - The model a message would be sent to, if one is chosen
 * @returns Whether attaching a picture is worth trying
 */
export function acceptsImages(model: InferenceApiModel | null): boolean {
  if (!model?.modalities) return true;
  return model.modalities.includes('image');
}
