import { Configuration } from '../types';

export const configToCustomOptions = (config: Configuration) => {
  // prepare params
  let params = {};

  if (config.overrideGenerationOptions)
    params = Object.assign(params, {
      temperature: config.temperature,
      top_k: config.top_k,
      top_p: config.top_p,
      min_p: config.min_p,
      max_tokens: config.max_tokens,
    });

  if (config.overrideSamplersOptions)
    params = Object.assign(params, {
      samplers: config.samplers,
      dynatemp_range: config.dynatemp_range,
      dynatemp_exponent: config.dynatemp_exponent,
      typical_p: config.typical_p,
      xtc_probability: config.xtc_probability,
      xtc_threshold: config.xtc_threshold,
    });

  if (config.overridePenaltyOptions)
    params = Object.assign(params, {
      repeat_last_n: config.repeat_last_n,
      repeat_penalty: config.repeat_penalty,
      presence_penalty: config.presence_penalty,
      frequency_penalty: config.frequency_penalty,
      dry_multiplier: config.dry_multiplier,
      dry_base: config.dry_base,
      dry_allowed_length: config.dry_allowed_length,
      dry_penalty_last_n: config.dry_penalty_last_n,
    });

  if (config.custom.trim().length) {
    try {
      params = Object.assign(params, JSON.parse(config.custom));
    } catch (e) {
      console.error('Failed to parse custom configuration:', e);
    }
  }

  return params;
};
