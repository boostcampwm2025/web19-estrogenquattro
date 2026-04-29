import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EffectId = "sparkle" | "electric" | "fire" | "matrix";

export interface EffectItem {
  id: EffectId;
  name: string;
  description: string;
  cost: number;
  emoji: string;
}

export const EFFECT_CATALOG: EffectItem[] = [
  {
    id: "sparkle",
    name: "별빛",
    description: "캐릭터 주위에 별이 반짝반짝 빛납니다",
    cost: 100,
    emoji: "✨",
  },
  {
    id: "electric",
    name: "번개",
    description: "캐릭터 주위에 전기가 지지직 튑니다",
    cost: 100,
    emoji: "⚡",
  },
  {
    id: "fire",
    name: "화염",
    description: "캐릭터 뒤에서 불꽃이 이글이글 타오릅니다",
    cost: 100,
    emoji: "🔥",
  },
  {
    id: "matrix",
    name: "매트릭스",
    description: "캐릭터 주위에 녹색 코드 비가 내립니다",
    cost: 100,
    emoji: "💻",
  },
];

export interface LangItem {
  key: string;
  name: string;
  cost: number;
}

export const LANG_CATALOG: LangItem[] = [
  { key: "js", name: "JavaScript", cost: 50 },
  { key: "ts", name: "TypeScript", cost: 50 },
  { key: "rust", name: "Rust", cost: 50 },
  { key: "java", name: "Java", cost: 50 },
  { key: "python", name: "Python", cost: 50 },
  { key: "kotlin", name: "Kotlin", cost: 50 },
  { key: "C", name: "C", cost: 50 },
  { key: "Cp", name: "C++", cost: 50 },
  { key: "go", name: "Go", cost: 50 },
  { key: "haskell", name: "Haskell", cost: 50 },
  { key: "nest", name: "NestJS", cost: 50 },
  { key: "pytorch", name: "PyTorch", cost: 50 },
  { key: "react", name: "React", cost: 50 },
  { key: "spring", name: "Spring", cost: 50 },
  { key: "tensor", name: "TensorFlow", cost: 50 },
  { key: "swift", name: "Swift", cost: 50 },
  { key: "hf", name: "HuggingFace", cost: 50 },
];

interface EffectStore {
  purchased: EffectId[];
  equipped: EffectId | null;
  purchasedLangs: string[];
  equippedLang: string | null;
  markPurchased: (id: EffectId) => void;
  equip: (id: EffectId | null) => void;
  markLangPurchased: (key: string) => void;
  equipLang: (key: string | null) => void;
}

export const useEffectStore = create<EffectStore>()(
  persist(
    (set) => ({
      purchased: [],
      equipped: null,
      purchasedLangs: [],
      equippedLang: null,
      markPurchased: (id) => {
        set((s) => ({
          purchased: s.purchased.includes(id)
            ? s.purchased
            : [...s.purchased, id],
        }));
      },
      equip: (id) => {
        set({ equipped: id });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("local_effect_update", {
              detail: { effectId: id },
            }),
          );
        }
      },
      markLangPurchased: (key) => {
        set((s) => ({
          purchasedLangs: s.purchasedLangs.includes(key)
            ? s.purchasedLangs
            : [...s.purchasedLangs, key],
        }));
      },
      equipLang: (key) => {
        set({ equippedLang: key });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("local_lang_update", { detail: { langKey: key } }),
          );
        }
      },
    }),
    {
      name: "effect-store",
      partialize: (state: EffectStore) => ({
        purchased: state.purchased,
        equipped: state.equipped,
        purchasedLangs: state.purchasedLangs,
        equippedLang: state.equippedLang,
      }),
    },
  ),
);
