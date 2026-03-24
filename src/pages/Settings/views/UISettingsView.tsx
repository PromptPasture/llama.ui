import { useTranslation } from 'react-i18next';
import { LuMonitor } from 'react-icons/lu';
import { Icon } from '../../../components';
import { SUPPORTED_LANGUAGES } from '../../../i18n';
import { SettingInputType } from '../../../types/settings';
import { ThemeController } from '../components/ThemeController';
import {
  SettingsModalCheckbox,
  SettingsModalDropdown,
  SettingsModalShortInput,
  SettingsSectionLabel,
} from '../components';
import { SettingsTabViewProps } from '../types';

export function UISettingsView({
  config,
  language,
  onConfigChange,
  onLanguageChange,
}: SettingsTabViewProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsSectionLabel>
        <Icon size="sm" variant="leftside">
          <LuMonitor />
        </Icon>
        {t('settings.sections.userInterface')}
      </SettingsSectionLabel>

      <SettingsModalShortInput
        field={{ type: SettingInputType.SHORT_INPUT, key: 'initials' }}
        value={String(config.initials)}
        onChange={onConfigChange('initials')}
      />

      <SettingsModalDropdown
        field={{
          type: SettingInputType.DROPDOWN,
          key: 'custom',
          translateKey: 'language',
        }}
        value={language}
        options={SUPPORTED_LANGUAGES.map((lang) => ({
          value: lang.key,
          label: lang.label,
        }))}
        onChange={(nextValue) => onLanguageChange(String(nextValue))}
      />

      <ThemeController />

      <SettingsModalCheckbox
        field={{ type: SettingInputType.CHECKBOX, key: 'showRawUserMessage' }}
        value={!!config.showRawUserMessage}
        onChange={onConfigChange('showRawUserMessage')}
      />

      <SettingsModalCheckbox
        field={{
          type: SettingInputType.CHECKBOX,
          key: 'showRawAssistantMessage',
        }}
        value={!!config.showRawAssistantMessage}
        onChange={onConfigChange('showRawAssistantMessage')}
      />
    </>
  );
}
