"use client";

import { useShallow } from "zustand/react/shallow";
import {
  useEffectStore,
  EFFECT_CATALOG,
  type EffectId,
} from "@/stores/useEffectStore";

const PIXEL_BORDER = "border-3 border-amber-900";

interface Props {
  availablePoints: number;
}

export default function StoreTab({ availablePoints }: Props) {
  const { purchased, equipped, buy, equip } = useEffectStore(
    useShallow((s) => ({
      purchased: s.purchased,
      equipped: s.equipped,
      buy: s.buy,
      equip: s.equip,
    })),
  );

  const handleBuy = (id: EffectId) => {
    buy(id, availablePoints);
  };

  const handleEquip = (id: EffectId) => {
    if (equipped === id) {
      equip(null);
    } else {
      equip(id);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-amber-900">이펙트 상점</h3>
        <span className="rounded border-2 border-amber-900/20 bg-amber-100 px-3 py-0.5 text-sm font-bold text-amber-800">
          보유 포인트: {availablePoints.toLocaleString()} P
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {EFFECT_CATALOG.map((item) => {
          const isPurchased = purchased.includes(item.id);
          const isEquipped = equipped === item.id;
          const canAfford = availablePoints >= item.cost;

          return (
            <div
              key={item.id}
              className={`flex items-center gap-4 ${PIXEL_BORDER} bg-white/60 p-3 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]`}
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center border-2 border-amber-900/40 bg-amber-100 text-3xl">
                {item.emoji}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-900">{item.name}</span>
                  {isEquipped && (
                    <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      장착중
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-amber-700">{item.description}</p>
                {!isPurchased && (
                  <p className="mt-1 text-xs font-bold text-amber-600">
                    {item.cost.toLocaleString()} P
                  </p>
                )}
              </div>

              <div className="shrink-0">
                {isPurchased ? (
                  <button
                    onClick={() => handleEquip(item.id)}
                    className={`${PIXEL_BORDER} cursor-pointer px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                      isEquipped
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : "bg-amber-200 text-amber-900 hover:bg-amber-300"
                    }`}
                  >
                    {isEquipped ? "해제" : "장착"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleBuy(item.id)}
                    disabled={!canAfford}
                    className={`${PIXEL_BORDER} px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] transition-all ${
                      canAfford
                        ? "cursor-pointer bg-green-500 text-white hover:bg-green-600 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                        : "cursor-not-allowed bg-gray-300 text-gray-500 opacity-60"
                    }`}
                  >
                    구매
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-amber-600/70">
        * 구매한 이펙트는 본인 캐릭터에만 적용됩니다
      </p>
    </div>
  );
}
