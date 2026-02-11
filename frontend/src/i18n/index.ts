import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import koCommon from "../locales/ko/common.json";
import koUi from "../locales/ko/ui.json";
import koGame from "../locales/ko/game.json";
import koOnboarding from "../locales/ko/onboarding.json";
import enCommon from "../locales/en/common.json";
import enUi from "../locales/en/ui.json";
import enGame from "../locales/en/game.json";
import enOnboarding from "../locales/en/onboarding.json";

export const defaultNS = "ui";

export const resources = {
  ko: { common: koCommon, ui: koUi, game: koGame, onboarding: koOnboarding },
  en: { common: enCommon, ui: enUi, game: enGame, onboarding: enOnboarding },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    defaultNS,
    interpolation: {
      escapeValue: false,
    },
    // 리소스가 이미 번들에 포함되어 있으므로 동기 초기화
    initImmediate: false,
  });

export default i18n;
