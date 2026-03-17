// React 컴포넌트 테스트용 setup (src/**/*.test.tsx 파일에서 사용)
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import koCommon from "../locales/ko/common.json";
import koUi from "../locales/ko/ui.json";
import koGame from "../locales/ko/game.json";
import enCommon from "../locales/en/common.json";
import enUi from "../locales/en/ui.json";
import enGame from "../locales/en/game.json";

function createStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

const storage =
  typeof window !== "undefined" &&
  typeof window.localStorage?.getItem === "function" &&
  typeof window.localStorage?.setItem === "function" &&
  typeof window.localStorage?.clear === "function"
    ? window.localStorage
    : createStorageMock();

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
}

// 테스트 환경에서 i18n 초기화 (한국어 기본)
i18n.use(initReactI18next).init({
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
  lng: "ko", // 테스트는 한국어로 실행
  fallbackLng: "ko",
  defaultNS: "ui",
  interpolation: {
    escapeValue: false,
  },
});

afterEach(() => {
  storage.clear();
  cleanup();
});
