import i18next from "i18next";
import { initReactI18next } from "react-i18next";

// Korean (default)
import koCommon from "@/locales/ko/common.json";
import koGame from "@/locales/ko/game.json";
import koUi from "@/locales/ko/ui.json";

// English
import enCommon from "@/locales/en/common.json";
import enGame from "@/locales/en/game.json";
import enUi from "@/locales/en/ui.json";

const STORAGE_KEY = "app-language";

function getInitialLanguage(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
  }
  return "ko";
}

i18next.use(initReactI18next).init({
  resources: {
    ko: {
      common: koCommon,
      game: koGame,
      ui: koUi,
    },
    en: {
      common: enCommon,
      game: enGame,
      ui: enUi,
    },
  },
  lng: getInitialLanguage(),
  fallbackLng: "ko",
  defaultNS: "common",
  ns: ["common", "game", "ui"],
  interpolation: {
    escapeValue: false, // React already handles XSS
  },
});

// 언어 변경 시 localStorage에 저장
i18next.on("languageChanged", (lng) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, lng);
  }
});

export default i18next;
