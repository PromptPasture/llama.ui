import { useTranslation } from 'react-i18next';
import { LuBrain, LuMessageCircleMore, LuRocket } from 'react-icons/lu';
import { Icon } from '../../../components';
import { SettingInputType } from '../../../types/settings';
import {
  DelimeterComponent,
  SettingsModalCheckbox,
  SettingsModalShortInput,
  SettingsSectionLabel,
} from '../components';
import { SettingsTabViewProps } from '../types';

export function ConversationsSettingsView({
  config,
  onConfigChange,
}: SettingsTabViewProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsSectionLabel>
        <Icon size="sm" variant="leftside">
          <LuMessageCircleMore />
        </Icon>
        {t('settings.sections.chat')}
      </SettingsSectionLabel>

      <SettingsModalShortInput
        field={{
          type: SettingInputType.SHORT_INPUT,
          key: 'pasteLongTextToFileLen',
        }}
        value={config.pasteLongTextToFileLen}
        onChange={onConfigChange('pasteLongTextToFileLen')}
      />

      <SettingsModalCheckbox
        field={{ type: SettingInputType.CHECKBOX, key: 'pdfAsImage' }}
        value={!!config.pdfAsImage}
        onChange={onConfigChange('pdfAsImage')}
      />

      <DelimeterComponent />

      <SettingsSectionLabel>
        <Icon size="sm" variant="leftside">
          <LuRocket />
        </Icon>
        {t('settings.sections.performance')}
      </SettingsSectionLabel>

      <SettingsModalCheckbox
        field={{ type: SettingInputType.CHECKBOX, key: 'showTokensPerSecond' }}
        value={!!config.showTokensPerSecond}
        onChange={onConfigChange('showTokensPerSecond')}
      />

      <DelimeterComponent />

      <SettingsSectionLabel>
        <Icon size="sm" variant="leftside">
          <LuBrain />
        </Icon>
        {t('settings.sections.reasoning')}
      </SettingsSectionLabel>

      <SettingsModalCheckbox
        field={{
          type: SettingInputType.CHECKBOX,
          key: 'showThoughtInProgress',
        }}
        value={!!config.showThoughtInProgress}
        onChange={onConfigChange('showThoughtInProgress')}
      />

      <SettingsModalCheckbox
        field={{ type: SettingInputType.CHECKBOX, key: 'excludeThoughtOnReq' }}
        value={!!config.excludeThoughtOnReq}
        onChange={onConfigChange('excludeThoughtOnReq')}
      />
    </>
  );
}
