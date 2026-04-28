import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EffectId = "sparkle" | "electric" | "fire";

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
    name: "별빛 오라",
    description: "캐릭터 주위에 별이 반짝반짝 빛납니다",
    cost: 10,
    emoji: "✨",
  },
  {
    id: "electric",
    name: "번개 오라",
    description: "캐릭터 주위에 전기가 지지직 튑니다",
    cost: 10,
    emoji: "⚡",
  },
  {
    id: "fire",
    name: "화염 오라",
    description: "캐릭터 뒤에서 불꽃이 이글이글 타오릅니다",
    cost: 10,
    emoji: "🔥",
  },
];

interface EffectStore {
  purchased: EffectId[];
  equipped: EffectId | null;
  localSpentPoints: number;
  buy: (id: EffectId, currentServerPoints: number) => boolean;
  equip: (id: EffectId | null) => void;
}

export const useEffectStore = create<EffectStore>()(
  persist(
    (set, get) => ({
      purchased: [],
      equipped: null,
      localSpentPoints: 0,
      buy: (id, currentServerPoints) => {
        const { purchased, localSpentPoints } = get();
        if (purchased.includes(id)) return false;
        const item = EFFECT_CATALOG.find((e) => e.id === id);
        if (!item) return false;
        const availablePoints = currentServerPoints - localSpentPoints;
        if (availablePoints < item.cost) return false;
        set({
          purchased: [...purchased, id],
          localSpentPoints: localSpentPoints + item.cost,
        });
        return true;
      },
      equip: (id) => {
        set({ equipped: id });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("local_effect_update", { detail: { effectId: id } }),
          );
        }
      },
    }),
    {
      name: "effect-store",
      partialize: (state: EffectStore) => ({
        purchased: state.purchased,
        equipped: state.equipped,
        localSpentPoints: state.localSpentPoints,
      }),
    },
  ),
);
