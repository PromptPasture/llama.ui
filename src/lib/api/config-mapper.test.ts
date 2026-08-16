import { describe, expect, it, vi } from 'vitest';
import { configToCustomOptions } from './config-mapper';
import CONFIG_DEFAULT from '../config/config-default.json';
import type { Configuration } from '../types';

const config = (overrides: Partial<Configuration> = {}) =>
  ({ ...CONFIG_DEFAULT, ...overrides }) as Configuration;

describe('sending nothing unless asked', () => {
  it('sends no parameters with every override off', () => {
    expect(
      configToCustomOptions(
        config({
          overrideGenerationOptions: false,
          overrideSamplersOptions: false,
          overridePenaltyOptions: false,
          custom: '',
        })
      )
    ).toEqual({});
  });
});

describe('the override groups', () => {
  it('sends the generation options when that group is enabled', () => {
    const params = configToCustomOptions(
      config({
        overrideGenerationOptions: true,
        temperature: 0.25,
        top_k: 40,
        top_p: 0.9,
        min_p: 0.05,
        max_tokens: 512,
        custom: '',
      })
    );

    expect(params).toMatchObject({
      temperature: 0.25,
      top_k: 40,
      top_p: 0.9,
      min_p: 0.05,
      max_tokens: 512,
    });
  });

  it('sends the sampler options when that group is enabled', () => {
    const params = configToCustomOptions(
      config({
        overrideSamplersOptions: true,
        typical_p: 0.8,
        xtc_probability: 0.1,
        custom: '',
      })
    );

    expect(params).toMatchObject({ typical_p: 0.8, xtc_probability: 0.1 });
  });

  it('sends the penalty options when that group is enabled', () => {
    const params = configToCustomOptions(
      config({
        overridePenaltyOptions: true,
        repeat_penalty: 1.15,
        dry_multiplier: 1.5,
        custom: '',
      })
    );

    expect(params).toMatchObject({ repeat_penalty: 1.15, dry_multiplier: 1.5 });
  });

  it('keeps the groups independent', () => {
    const params = configToCustomOptions(
      config({
        overrideGenerationOptions: true,
        temperature: 0.3,
        overridePenaltyOptions: false,
        repeat_penalty: 1.15,
        custom: '',
      })
    );

    expect(params).toHaveProperty('temperature');
    expect(params).not.toHaveProperty('repeat_penalty');
  });
});

describe('the custom JSON field', () => {
  it('merges what it contains', () => {
    const params = configToCustomOptions(
      config({ custom: '{"seed": 42, "mirostat": 2}' })
    );

    expect(params).toMatchObject({ seed: 42, mirostat: 2 });
  });

  it('takes precedence over the override groups, being merged last', () => {
    const params = configToCustomOptions(
      config({
        overrideGenerationOptions: true,
        temperature: 0.2,
        custom: '{"temperature": 0.9}',
      })
    );

    expect(params).toMatchObject({ temperature: 0.9 });
  });

  it('ignores whitespace', () => {
    expect(configToCustomOptions(config({ custom: '   ' }))).toEqual({});
  });

  it('drops malformed JSON rather than failing the request', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    // The settings screen refuses to save this, so it should not arrive here;
    // if it somehow does, a broken value must not stop the user sending
    // anything at all.
    const params = configToCustomOptions(
      config({
        overrideGenerationOptions: true,
        temperature: 0.2,
        custom: '{oops',
      })
    );

    expect(params).toMatchObject({ temperature: 0.2 });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
