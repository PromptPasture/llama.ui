import { useTranslation } from 'react-i18next';
import { LuCog, LuCpu, LuFilter, LuHand } from 'react-icons/lu';
import { Icon } from '../../../components';
import { ConfigurationKey } from '../../../types';
import { SettingInputType } from '../../../types/settings';
import {
  DelimeterComponent,
  SettingsModalCheckbox,
  SettingsModalLongInput,
  SettingsModalShortInput,
  SettingsSectionLabel,
} from '../components';
import { SettingsTabViewProps } from '../types';

const generationKeys: ConfigurationKey[] = [
  'temperature',
  'top_k',
  'top_p',
  'min_p',
  'max_tokens',
];

const samplerKeys: ConfigurationKey[] = [
  'samplers',
  'dynatemp_range',
  'dynatemp_exponent',
  'typical_p',
  'xtc_probability',
  'xtc_threshold',
];

const penaltyKeys: ConfigurationKey[] = [
  'repeat_last_n',
  'repeat_penalty',
  'presence_penalty',
  'frequency_penalty',
  'dry_multiplier',
  'dry_base',
  'dry_allowed_length',
  'dry_penalty_last_n',
];

export function AdvancedSettingsView({
  config,
  onConfigChange,
}: SettingsTabViewProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsSectionLabel>
        <Icon size="sm" variant="leftside">
          <LuCog />
        </Icon>
        {t('settings.sections.generation')}
      </SettingsSectionLabel>

      <SettingsModalCheckbox
        field={{
          type: SettingInputType.CHECKBOX,
          key: 'overrideGenerationOptions',
        }}
        value={!!config.overrideGenerationOptions}
        onChange={onConfigChange('overrideGenerationOptions')}
      />

      {generationKeys.map((configKey) => (
        <SettingsModalShortInput
          key={configKey}
          field={{
            type: SettingInputType.SHORT_INPUT,
            key: configKey,
            disabled: !config.overrideGenerationOptions,
          }}
          value={config[configKey] as string | number}
          onChange={onConfigChange(configKey)}
        />
      ))}

      <DelimeterComponent />

      <SettingsSectionLabel>
        <Icon size="sm" variant="leftside">
          <LuFilter />
        </Icon>
        {t('settings.sections.samplers')}
      </SettingsSectionLabel>

      <SettingsModalCheckbox
        field={{
          type: SettingInputType.CHECKBOX,
          key: 'overrideSamplersOptions',
        }}
        value={!!config.overrideSamplersOptions}
        onChange={onConfigChange('overrideSamplersOptions')}
      />

      {samplerKeys.map((configKey) => (
        <SettingsModalShortInput
          key={configKey}
          field={{
            type: SettingInputType.SHORT_INPUT,
            key: configKey,
            disabled: !config.overrideSamplersOptions,
          }}
          value={config[configKey] as string | number}
          onChange={onConfigChange(configKey)}
        />
      ))}

      <DelimeterComponent />

      <SettingsSectionLabel>
        <Icon size="sm" variant="leftside">
          <LuHand />
        </Icon>
        {t('settings.sections.penalties')}
      </SettingsSectionLabel>

      <SettingsModalCheckbox
        field={{
          type: SettingInputType.CHECKBOX,
          key: 'overridePenaltyOptions',
        }}
        value={!!config.overridePenaltyOptions}
        onChange={onConfigChange('overridePenaltyOptions')}
      />

      {penaltyKeys.map((configKey) => (
        <SettingsModalShortInput
          key={configKey}
          field={{
            type: SettingInputType.SHORT_INPUT,
            key: configKey,
            disabled: !config.overridePenaltyOptions,
          }}
          value={config[configKey] as string | number}
          onChange={onConfigChange(configKey)}
        />
      ))}

      <DelimeterComponent />

      <SettingsSectionLabel>
        <Icon size="sm" variant="leftside">
          <LuCpu />
        </Icon>
        {t('settings.sections.custom')}
      </SettingsSectionLabel>

      <SettingsModalLongInput
        field={{ type: SettingInputType.LONG_INPUT, key: 'custom' }}
        value={String(config.custom)}
        onChange={onConfigChange('custom')}
      />
    </>
  );
}
