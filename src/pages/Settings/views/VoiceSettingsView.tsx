import { useTranslation } from 'react-i18next';
import { LuSpeech, LuVolume2, LuVolumeX } from 'react-icons/lu';
import { Button, Icon } from '../../../components';
import TextToSpeech, {
  getSpeechSynthesisVoiceByName,
  getSpeechSynthesisVoices,
  IS_SPEECH_SYNTHESIS_SUPPORTED,
} from '../../../hooks/useTextToSpeech';
import { SettingInputType } from '../../../types/settings';
import {
  SettingsModalDropdown,
  SettingsModalRangeInput,
  SettingsSectionLabel,
} from '../components';
import { SettingsTabViewProps } from '../types';

export function VoiceSettingsView({
  config,
  onConfigChange,
}: SettingsTabViewProps) {
  const { t } = useTranslation();

  return (
    <>
      <SettingsSectionLabel>
        <Icon size="sm" variant="leftside">
          <LuSpeech />
        </Icon>
        {t('settings.sections.textToSpeech')}
      </SettingsSectionLabel>

      <SettingsModalDropdown
        field={{ type: SettingInputType.DROPDOWN, key: 'ttsVoice' }}
        value={String(config.ttsVoice)}
        onChange={onConfigChange('ttsVoice')}
        filterable
        options={
          !IS_SPEECH_SYNTHESIS_SUPPORTED
            ? []
            : getSpeechSynthesisVoices().map((voice) => ({
                value: `${voice.name} (${voice.lang})`,
                label: `${voice.name} (${voice.lang})`,
              }))
        }
      />

      <SettingsModalRangeInput
        field={{
          type: SettingInputType.RANGE_INPUT,
          key: 'ttsPitch',
          disabled: !IS_SPEECH_SYNTHESIS_SUPPORTED,
        }}
        value={config.ttsPitch}
        onChange={onConfigChange('ttsPitch')}
        min={0}
        max={2}
        step={0.5}
      />

      <SettingsModalRangeInput
        field={{
          type: SettingInputType.RANGE_INPUT,
          key: 'ttsRate',
          disabled: !IS_SPEECH_SYNTHESIS_SUPPORTED,
        }}
        value={config.ttsRate}
        onChange={onConfigChange('ttsRate')}
        min={0.5}
        max={2}
        step={0.5}
      />

      <SettingsModalRangeInput
        field={{
          type: SettingInputType.RANGE_INPUT,
          key: 'ttsVolume',
          disabled: !IS_SPEECH_SYNTHESIS_SUPPORTED,
        }}
        value={config.ttsVolume}
        onChange={onConfigChange('ttsVolume')}
        min={0}
        max={1}
        step={0.25}
      />

      <TextToSpeech
        text={t('settings.textToSpeech.check.text')}
        voice={getSpeechSynthesisVoiceByName(config.ttsVoice)}
        pitch={config.ttsPitch}
        rate={config.ttsRate}
        volume={config.ttsVolume}
      >
        {({ isPlaying, play, stop }) => (
          <Button
            onClick={() => (!isPlaying ? play() : stop())}
            disabled={!IS_SPEECH_SYNTHESIS_SUPPORTED}
            title="Play test message"
            aria-label="Play test message"
          >
            {!isPlaying && (
              <Icon size="sm" variant="leftside">
                <LuVolume2 />
              </Icon>
            )}
            {isPlaying && (
              <Icon size="sm" variant="leftside">
                <LuVolumeX />
              </Icon>
            )}
            {t('settings.textToSpeech.check.label')}
          </Button>
        )}
      </TextToSpeech>
    </>
  );
}
