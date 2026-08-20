import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es419 from '../../../locales/es-419.json';

i18n.use(initReactI18next).init({
  lng: 'es-419',
  fallbackLng: 'es-419',
  supportedLngs: ['es-419'],
  defaultNS: 'translation',
  resources: {
    'es-419': { translation: es419 },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export { i18n };
