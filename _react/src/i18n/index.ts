import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { isDev } from '../config';

import en from './en.json';
import zh from './zh-CN.json';
import hi from './hi.json';
import es from './es.json';
import fr from './fr.json';
import ru from './ru.json';
import pt from './pt.json';
import de from './de.json';
import ja from './ja.json';
import ko from './ko.json';
import it from './it.json';
import ar from './ar.json';

export const SUPPORTED_LANGUAGES = [
  { key: 'en', name: 'English', label: 'English' },
  { key: 'zh', name: 'Chinese Simplified', label: '汉语' },
  { key: 'hi', name: 'Hindi', label: 'हिन्दी' },
  { key: 'es', name: 'Spanish', label: 'Español' },
  { key: 'fr', name: 'French', label: 'Français' },
  { key: 'ru', name: 'Russian', label: 'Русский' },
  { key: 'pt', name: 'Portuguese', label: 'Português' },
  { key: 'de', name: 'German', label: 'Deutsch' },
  { key: 'ja', name: 'Japanese', label: '日本語' },
  { key: 'ko', name: 'Korean', label: '한국어' },
  { key: 'it', name: 'Italian', label: 'Italiano' },
  { key: 'ar', name: 'Arabic', label: 'اَلْعَرَبِيَّةُ' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: SUPPORTED_LANGUAGES.map((lang) => lang.key),
    fallbackLng: 'en',
    debug: isDev,
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: {
        translation: en,
      },
      zh: {
        translation: zh,
      },
      hi: {
        translation: hi,
      },
      es: {
        translation: es,
      },
      fr: {
        translation: fr,
      },
      ru: {
        translation: ru,
      },
      pt: {
        translation: pt,
      },
      de: {
        translation: de,
      },
      ja: {
        translation: ja,
      },
      ko: {
        translation: ko,
      },
      it: {
        translation: it,
      },
      ar: {
        translation: ar,
      },
    },
  });

export default i18n;
