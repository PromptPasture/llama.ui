import { describe, expect, it } from 'vitest';
import { acceptsImages } from './model-capabilities';
import type { InferenceApiModel } from '$lib/types';

const model = (overrides: Partial<InferenceApiModel> = {}): InferenceApiModel =>
  ({ id: 'a-model', name: 'A model', ...overrides }) as InferenceApiModel;

describe('whether a model can be sent a picture', () => {
  it('says yes when it lists vision among what it takes', () => {
    expect(acceptsImages(model({ modalities: ['text', 'image'] }))).toBe(true);
  });

  it('says no when it lists what it takes and vision is not there', () => {
    expect(acceptsImages(model({ modalities: ['text'] }))).toBe(false);
  });

  it('says yes when it says nothing at all', () => {
    // Most providers report no modalities. Treating silence as a refusal
    // would refuse every picture on every provider but the three that do.
    expect(acceptsImages(model())).toBe(true);
  });

  it('says yes when no model is chosen yet', () => {
    expect(acceptsImages(null)).toBe(true);
  });

  it('says no for a model that lists only audio', () => {
    expect(acceptsImages(model({ modalities: ['text', 'audio'] }))).toBe(false);
  });

  it('says yes for one that takes everything', () => {
    expect(
      acceptsImages(model({ modalities: ['text', 'image', 'audio', 'video'] }))
    ).toBe(true);
  });

  it('says no when it lists nothing it takes', () => {
    // An empty list is a statement, unlike an absent one.
    expect(acceptsImages(model({ modalities: [] }))).toBe(false);
  });
});
