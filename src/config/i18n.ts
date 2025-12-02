import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import en from '../locales/en.json';
import tr from '../locales/tr.json';

// Telefonun dilini algıla
const deviceLanguage = RNLocalize.getLocales()[0]?.languageCode || 'en';

// Desteklenen dilleri kontrol et
const supportedLanguages = ['en', 'tr'];
const fallbackLanguage = supportedLanguages.includes(deviceLanguage)
    ? deviceLanguage
    : 'en';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                translation: en,
            },
            tr: {
                translation: tr,
            },
        },
        lng: fallbackLanguage,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
