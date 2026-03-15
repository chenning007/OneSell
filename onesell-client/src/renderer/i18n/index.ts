import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from './locales/en.js';
import zhCn from './locales/zh-cn.js';
import ja from './locales/ja.js';
import de from './locales/de.js';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCn },
    ja: { translation: ja },
    de: { translation: de },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export { useTranslation };
export { i18n as default };

export function switchLanguage(lang: string): void {
  void i18n.changeLanguage(lang);
}
