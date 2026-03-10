import { Configuration } from '../types';
import defaultConfig from './config-default.json';

/**
 * Default configuration object
 * @constant
 * @type {Readonly<Configuration>}
 * @description Immutable default configuration loaded from config-default.json
 * @see Configuration
 */
export const CONFIG_DEFAULT: Readonly<Configuration> =
  Object.freeze(defaultConfig);
