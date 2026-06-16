import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button, Dropdown, Icon } from '../../components';
import { CONFIG_DEFAULT, INFERENCE_PROVIDERS } from '../../config';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import { useAppContext } from '../../store/app';
import { useChatContext } from '../../store/chat';
import { useInferenceContext } from '../../store/inference';
import { useModals } from '../../store/modal';
import {
  Configuration,
  ConfigurationKey,
  InferenceApiModel,
  InferenceProvidersKey,
} from '../../types';
import { classNames } from '../../utils/css-helpers';
import { isBoolean, isNumeric, isString } from '../../utils/type-guards';
import { SettingsTabViewProps } from './types';
import { SETTINGS_TAB_DESCRIPTORS } from './tabs';

interface SettingsTabOption {
  id: string;
  title: ReactNode;
  View: React.ComponentType<SettingsTabViewProps>;
}

export default function Settings() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const {
    config,
    saveConfig,
    presets,
    savePreset,
    removePreset,
    setShowSettings,
  } = useAppContext();
  const { models, fetchModels } = useInferenceContext();
  const { viewingChat } = useChatContext();
  const [tabIdx, setTabIdx] = useState(0);

  // Clone to avoid direct mutation while editing.
  const [localConfig, setLocalConfig] = useState<Configuration>(
    Object.assign({}, config)
  );
  const [localModels, setLocalModels] = useState<InferenceApiModel[]>(
    Object.assign([], models)
  );

  const settingTabs = useMemo<SettingsTabOption[]>(
    () =>
      SETTINGS_TAB_DESCRIPTORS.map((tab) => {
        const TabIcon = tab.icon;
        return {
          id: tab.id,
          View: tab.View,
          title: (
            <>
              <Icon size="sm" variant="leftside">
                <TabIcon />
              </Icon>
              {t(tab.titleKey)}
            </>
          ),
        };
      }),
    [t]
  );
  const currentTab = settingTabs[tabIdx] ??
    settingTabs[0] ?? {
      id: 'fallback',
      title: '',
      View: () => null,
    };
  const CurrentTabView = currentTab.View;
  const currConv = useMemo(() => viewingChat?.conv ?? null, [viewingChat]);

  useEffect(() => {
    setShowSettings(true);

    return () => {
      setShowSettings(false);
    };
  }, [setShowSettings]);

  const { showConfirm, showAlert } = useModals();

  const onClose = useCallback(() => {
    if (currConv) navigate(`/chat/${currConv.id}`);
    else navigate('/');
  }, [currConv, navigate]);

  const resetConfig = useCallback(async () => {
    if (await showConfirm('Are you sure you want to reset all settings?')) {
      setLocalConfig({ ...CONFIG_DEFAULT } as Configuration);
    }
  }, [showConfirm]);

  const handleSave = useCallback(
    async (configToSave: Configuration) => {
      // Copy local config to prevent direct mutation.
      const newConfig: Configuration = JSON.parse(JSON.stringify(configToSave));

      for (const key in newConfig) {
        if (!(key in CONFIG_DEFAULT)) continue;

        const typedKey = key as ConfigurationKey;
        const value = newConfig[typedKey];
        const defaultValue = CONFIG_DEFAULT[typedKey];
        if (isString(defaultValue)) {
          if (!isString(value)) {
            await showAlert(`Value for ${key} must be a string`);
            return;
          }
        } else if (isNumeric(defaultValue)) {
          const trimmedValue = String(value).trim();
          const numVal = Number(trimmedValue);
          if (isNaN(numVal) || !isNumeric(numVal) || trimmedValue === '') {
            await showAlert(`Value for ${key} must be numeric`);
            return;
          }
          // @ts-expect-error this is safe
          newConfig[typedKey] = numVal as Configuration[ConfigurationKey];
        } else if (isBoolean(defaultValue)) {
          if (!isBoolean(value)) {
            await showAlert(`Value for ${key} must be boolean`);
            return;
          }
        } else {
          console.error(`Unknown default type for key ${key}`);
        }
      }
      saveConfig(newConfig);
      onClose();
    },
    [onClose, saveConfig, showAlert]
  );

  const debouncedFetchModels = useDebouncedCallback(
    (newConfig: Configuration) =>
      fetchModels(newConfig, { silent: true }).then((nextModels) =>
        setLocalModels(nextModels)
      ),
    1000
  );

  const onConfigChange = useCallback(
    (key: ConfigurationKey) => (value: string | number | boolean) => {
      // Validation intentionally happens on save to allow partial user input.
      setLocalConfig((prevConfig) => {
        let nextConfig = {
          ...prevConfig,
          [key]: value,
        };

        if (key === 'provider') {
          const providerKey = value as InferenceProvidersKey;
          const providerInfo = INFERENCE_PROVIDERS[providerKey];
          if (providerInfo?.baseUrl) {
            nextConfig = {
              ...nextConfig,
              baseUrl: providerInfo.baseUrl,
            };
          }
        }

        if (['provider', 'baseUrl', 'apiKey'].includes(key)) {
          debouncedFetchModels(nextConfig);
        }

        return nextConfig;
      });
    },
    [debouncedFetchModels]
  );

  const onFetchModels = useCallback(async () => {
    const nextModels = await fetchModels(localConfig);
    setLocalModels(nextModels);
  }, [fetchModels, localConfig]);

  const onLanguageChange = useCallback(
    (language: string) => {
      void i18n.changeLanguage(language);
      document.documentElement.setAttribute('lang', language);
    },
    [i18n]
  );

  const tabViewProps: SettingsTabViewProps = {
    config: localConfig,
    models: localModels,
    presets,
    language: i18n.language,
    onConfigChange,
    onFetchModels,
    onLanguageChange,
    onClose,
    onSaveConfig: handleSave,
    onSavePreset: savePreset,
    onRemovePreset: removePreset,
  };

  return (
    <div className="flex flex-col h-full py-4">
      <div className="grow flex flex-col md:flex-row">
        <div
          className="hidden md:flex flex-col items-stretch px-4 border-r-2 border-base-200"
          role="complementary"
          aria-description="Settings sections"
          tabIndex={0}
        >
          {settingTabs.map((tab, idx) => (
            <Button
              key={tab.id}
              variant="ghost"
              className={classNames({
                'justify-start font-normal w-44 mb-1': true,
                'btn-active': tabIdx === idx,
              })}
              onClick={() => setTabIdx(idx)}
              dir="auto"
            >
              {tab.title}
            </Button>
          ))}
        </div>

        <div
          className="md:hidden flex flex-row gap-2 mb-4 px-4"
          aria-disabled={true}
        >
          <Dropdown
            className="bg-base-200 w-full border-1 border-base-content/10 rounded-lg shadow-xs cursor-pointer p-2"
            entity="tab"
            options={settingTabs.map((tab, idx) => ({
              label: tab.title,
              value: idx,
            }))}
            currentValue={currentTab.title}
            renderOption={(option) => <span>{option.label}</span>}
            isSelected={(option) => tabIdx === option.value}
            onSelect={(option) => setTabIdx(option.value as number)}
          />
        </div>

        <div className="grow max-h-[calc(100vh-13rem)] md:max-h-[calc(100vh-10rem)] overflow-y-auto px-6 sm:px-4">
          <CurrentTabView {...tabViewProps} />

          <p className="opacity-40 text-sm mt-8">
            <Trans
              i18nKey="settings.footer.version"
              values={{ version: import.meta.env.PACKAGE_VERSION }}
            />
            <br />
            <Trans i18nKey="settings.footer.storageNote" />
          </p>
        </div>
      </div>

      <div className="sticky bottom-4 flex gap-2 max-md:justify-center mt-4">
        <div className="hidden md:block w-54 h-10" />
        <Button variant="neutral" onClick={() => handleSave(localConfig)}>
          <Trans i18nKey="settings.actionButtons.saveBtnLabel" />
        </Button>
        <Button onClick={onClose}>
          <Trans i18nKey="settings.actionButtons.cancelBtnLabel" />
        </Button>
        <Button onClick={resetConfig}>
          <Trans i18nKey="settings.actionButtons.resetBtnLabel" />
        </Button>
      </div>
    </div>
  );
}
