import { useTranslation } from 'react-i18next';
import { SettingInputType } from '../../../types/settings';
import { SettingsModalCheckbox } from '../components';
import { SettingsTabViewProps } from '../types';

export function ExperimentalSettingsView({
  config,
  onConfigChange,
}: SettingsTabViewProps) {
  const { t } = useTranslation();

  return (
    <>
      <div
        className="flex flex-col gap-2 mb-8"
        dangerouslySetInnerHTML={{
          __html: t('settings.parameters.experimental.note'),
        }}
      />

      <SettingsModalCheckbox
        field={{ type: SettingInputType.CHECKBOX, key: 'pyIntepreterEnabled' }}
        value={!!config.pyIntepreterEnabled}
        onChange={onConfigChange('pyIntepreterEnabled')}
      />
    </>
  );
}
