import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import koCommon from "../locales/ko/common.json";
import koUi from "../locales/ko/ui.json";
import koGame from "../locales/ko/game.json";
import enCommon from "../locales/en/common.json";
import enUi from "../locales/en/ui.json";
import enGame from "../locales/en/game.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: {
        common: koCommon,
        ui: koUi,
        game: koGame,
      },
      en: {
        common: enCommon,
        ui: enUi,
        game: enGame,
      },
    },
    fallbackLng: "en",
    defaultNS: "ui",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
