import {
  Configuration,
  ConfigurationKey,
  ConfigurationPreset,
  InferenceApiModel,
} from '../../types';

export type SettingsValue = string | number | boolean;

export type SettingsOnChange = (
  key: ConfigurationKey
) => (value: SettingsValue) => void;

export interface SettingsTabViewProps {
  config: Configuration;
  models: InferenceApiModel[];
  presets: ConfigurationPreset[];
  language: string;
  onConfigChange: SettingsOnChange;
  onFetchModels: () => Promise<void>;
  onLanguageChange: (language: string) => void;
  onClose: () => void;
  onSaveConfig: (config: Configuration) => Promise<void>;
  onSavePreset: (name: string, config: Configuration) => Promise<void>;
  onRemovePreset: (name: string) => Promise<void>;
}
