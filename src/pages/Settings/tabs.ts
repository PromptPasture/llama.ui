import { ComponentType } from 'react';
import {
  LuAudioLines,
  LuBookmark,
  LuDatabase,
  LuFlaskConical,
  LuGrid2X2Plus,
  LuMessagesSquare,
  LuMonitor,
  LuSettings,
} from 'react-icons/lu';
import { IconType } from 'react-icons';
import { SettingsTabViewProps } from './types';
import { AdvancedSettingsView } from './views/AdvancedSettingsView';
import { ConversationsSettingsView } from './views/ConversationsSettingsView';
import { ExperimentalSettingsView } from './views/ExperimentalSettingsView';
import { GeneralSettingsView } from './views/GeneralSettingsView';
import { ImportExportSettingsView } from './views/ImportExportSettingsView';
import { PresetsSettingsView } from './views/PresetsSettingsView';
import { UISettingsView } from './views/UISettingsView';
import { VoiceSettingsView } from './views/VoiceSettingsView';

export interface SettingsTabDescriptor {
  id: string;
  titleKey: string;
  icon: IconType;
  View: ComponentType<SettingsTabViewProps>;
}

export const SETTINGS_TAB_DESCRIPTORS: SettingsTabDescriptor[] = [
  {
    id: 'general',
    titleKey: 'settings.tabs.general',
    icon: LuSettings,
    View: GeneralSettingsView,
  },
  {
    id: 'ui',
    titleKey: 'settings.tabs.ui',
    icon: LuMonitor,
    View: UISettingsView,
  },
  {
    id: 'voice',
    titleKey: 'settings.tabs.voice',
    icon: LuAudioLines,
    View: VoiceSettingsView,
  },
  {
    id: 'conversations',
    titleKey: 'settings.tabs.conversations',
    icon: LuMessagesSquare,
    View: ConversationsSettingsView,
  },
  {
    id: 'presets',
    titleKey: 'settings.tabs.presets',
    icon: LuBookmark,
    View: PresetsSettingsView,
  },
  {
    id: 'import-export',
    titleKey: 'settings.tabs.importExport',
    icon: LuDatabase,
    View: ImportExportSettingsView,
  },
  {
    id: 'advanced',
    titleKey: 'settings.tabs.advanced',
    icon: LuGrid2X2Plus,
    View: AdvancedSettingsView,
  },
  {
    id: 'experimental',
    titleKey: 'settings.sections.experimental',
    icon: LuFlaskConical,
    View: ExperimentalSettingsView,
  },
];
