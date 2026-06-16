import { Trans, useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';
import { Button, Icon } from '../../../components';
import { INFERENCE_PROVIDERS } from '../../../config';
import { ProviderOption } from '../../../types';
import { SettingInputType } from '../../../types/settings';
import {
  DelimeterComponent,
  SettingsModalDropdown,
  SettingsModalLongInput,
  SettingsModalShortInput,
  SettingsSectionLabel,
} from '../components';
import { SettingsTabViewProps } from '../types';

export function GeneralSettingsView({
  config,
  models,
  onConfigChange,
  onFetchModels,
}: SettingsTabViewProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsSectionLabel>
        {t('settings.sections.inferenceProvider')}
      </SettingsSectionLabel>

      <SettingsModalDropdown
        field={{ type: SettingInputType.DROPDOWN, key: 'provider' }}
        value={String(config.provider)}
        onChange={onConfigChange('provider')}
        options={Object.entries(INFERENCE_PROVIDERS).map(
          ([key, val]: [string, ProviderOption]) => ({
            value: key,
            label: val.name,
            icon: val.icon,
          })
        )}
      />

      <SettingsModalShortInput
        field={{
          type: SettingInputType.SHORT_INPUT,
          key: 'baseUrl',
          disabled: !INFERENCE_PROVIDERS[config.provider]?.allowCustomBaseUrl,
        }}
        value={String(config.baseUrl)}
        onChange={onConfigChange('baseUrl')}
      />

      <SettingsModalShortInput
        field={{ type: SettingInputType.SHORT_INPUT, key: 'apiKey' }}
        value={String(config.apiKey)}
        onChange={onConfigChange('apiKey')}
      />

      <SettingsModalDropdown
        field={{ type: SettingInputType.DROPDOWN, key: 'model' }}
        value={String(config.model)}
        onChange={onConfigChange('model')}
        filterable
        options={models.map((model) => ({
          value: model.id,
          label: model.name,
        }))}
      />

      <Button onClick={onFetchModels}>
        <Icon size="sm" variant="leftside">
          <LuRefreshCw />
        </Icon>
        <Trans i18nKey="settings.actionButtons.fetchModels" />
      </Button>

      <DelimeterComponent />
      <DelimeterComponent />

      <SettingsModalLongInput
        field={{ type: SettingInputType.LONG_INPUT, key: 'systemMessage' }}
        value={String(config.systemMessage)}
        onChange={onConfigChange('systemMessage')}
      />
    </>
  );
}
