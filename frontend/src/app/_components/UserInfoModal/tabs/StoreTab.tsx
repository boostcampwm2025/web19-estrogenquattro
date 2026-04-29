"use client";

import Image from "next/image";
import { useShallow } from "zustand/react/shallow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useEffectStore,
  EFFECT_CATALOG,
  LANG_CATALOG,
  type EffectId,
} from "@/stores/useEffectStore";
import { petApi } from "@/lib/api/pet";
import { queryKeys } from "@/lib/api/hooks/queryKeys";
import { useModalStore } from "@/stores/useModalStore";

const PIXEL_BORDER = "border-3 border-amber-900";

interface Props {
  availablePoints: number;
}

export default function StoreTab({ availablePoints }: Props) {
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const playerId = useModalStore((s) => s.userInfoPayload?.playerId ?? 0);

  const {
    purchased,
    equipped,
    equip,
    purchasedLangs,
    equippedLang,
    equipLang,
    markPurchased,
    markLangPurchased,
  } = useEffectStore(
    useShallow((s) => ({
      purchased: s.purchased,
      equipped: s.equipped,
      equip: s.equip,
      purchasedLangs: s.purchasedLangs,
      equippedLang: s.equippedLang,
      equipLang: s.equipLang,
      markPurchased: s.markPurchased,
      markLangPurchased: s.markLangPurchased,
    })),
  );

  const purchaseMutation = useMutation({
    mutationFn: (itemId: string) => petApi.purchaseItem(itemId),
    onSuccess: (data, itemId) => {
      // 서버에서 받은 차감된 포인트로 캐시 업데이트
      queryClient.setQueryData(
        queryKeys.player.info(playerId),
        (old: { totalPoint: number } | undefined) =>
          old ? { ...old, totalPoint: data.totalPoint } : old,
      );
      // 구매 완료 → 로컬 purchased 목록에 추가
      const effectItem = EFFECT_CATALOG.find((e) => e.id === itemId);
      if (effectItem) {
        markPurchased(itemId as EffectId);
      } else {
        markLangPurchased(itemId);
      }
    },
  });

  const handleBuy = (itemId: string) => {
    if (purchaseMutation.isPending) return;
    purchaseMutation.mutate(itemId);
  };

  const handleEquip = (id: EffectId) => {
    if (equipped === id) equip(null);
    else equip(id);
  };

  const handleEquipLang = (key: string) => {
    if (equippedLang === key) equipLang(null);
    else equipLang(key);
  };

  const isPending = purchaseMutation.isPending;

  const effectName = (id: EffectId) => {
    if (id === "sparkle") return t(($) => $.store.effects.sparkle.name);
    if (id === "electric") return t(($) => $.store.effects.electric.name);
    if (id === "fire") return t(($) => $.store.effects.fire.name);
    return t(($) => $.store.effects.matrix.name);
  };

  const effectDescription = (id: EffectId) => {
    if (id === "sparkle") return t(($) => $.store.effects.sparkle.description);
    if (id === "electric")
      return t(($) => $.store.effects.electric.description);
    if (id === "fire") return t(($) => $.store.effects.fire.description);
    return t(($) => $.store.effects.matrix.description);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-amber-900">
          {t(($) => $.store.characterEffect)}
        </h3>
        <span className="rounded border-2 border-amber-900/20 bg-amber-100 px-3 py-0.5 text-sm font-bold text-amber-800">
          {t(($) => $.store.ownedPoints, {
            points: availablePoints.toLocaleString(),
          })}
        </span>
      </div>

      {/* 이펙트 섹션 */}
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

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-900">
                    {effectName(item.id)}
                  </span>
                  {isEquipped && (
                    <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {t(($) => $.store.equipped)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-amber-700">
                  {effectDescription(item.id)}
                </p>
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
                    {isEquipped
                      ? t(($) => $.store.unequip)
                      : t(($) => $.store.equip)}
                  </button>
                ) : (
                  <button
                    onClick={() => handleBuy(item.id)}
                    disabled={!canAfford || isPending}
                    className={`${PIXEL_BORDER} px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0_0_rgba(0,0,0,0.3)] transition-all ${
                      canAfford && !isPending
                        ? "cursor-pointer bg-green-500 text-white hover:bg-green-600 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                        : "cursor-not-allowed bg-gray-300 text-gray-500 opacity-60"
                    }`}
                  >
                    {t(($) => $.store.buy)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 던지기 이펙트 섹션 */}
      <div>
        <h3 className="mb-3 font-bold text-amber-900">
          {t(($) => $.store.throwEffect)}
        </h3>
        <p className="mb-3 text-xs text-amber-700">
          {t(($) => $.store.throwEffectHint)}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {LANG_CATALOG.map((item) => {
            const isPurchased = purchasedLangs.includes(item.key);
            const isEquipped = equippedLang === item.key;
            const canAfford = availablePoints >= item.cost;

            return (
              <div
                key={item.key}
                className={`flex flex-col items-center gap-1.5 ${PIXEL_BORDER} bg-white/60 p-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)] ${isEquipped ? "bg-amber-100/80" : ""}`}
              >
                <div className="relative h-10 w-10">
                  <Image
                    src={`/assets/lang/${item.key}.svg`}
                    alt={item.name}
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="text-center text-[10px] leading-tight font-bold text-amber-900">
                  {item.name}
                </span>
                {isEquipped && (
                  <span className="rounded bg-amber-600 px-1 py-0.5 text-[9px] font-bold text-white">
                    {t(($) => $.store.equipped)}
                  </span>
                )}
                {isPurchased ? (
                  <button
                    onClick={() => handleEquipLang(item.key)}
                    className={`${PIXEL_BORDER} w-full cursor-pointer py-0.5 text-[10px] font-bold shadow-[1px_1px_0_0_rgba(0,0,0,0.3)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                      isEquipped
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : "bg-amber-200 text-amber-900 hover:bg-amber-300"
                    }`}
                  >
                    {isEquipped
                      ? t(($) => $.store.unequip)
                      : t(($) => $.store.equip)}
                  </button>
                ) : (
                  <button
                    onClick={() => handleBuy(item.key)}
                    disabled={!canAfford || isPending}
                    className={`${PIXEL_BORDER} w-full py-0.5 text-[10px] font-bold shadow-[1px_1px_0_0_rgba(0,0,0,0.3)] transition-all ${
                      canAfford && !isPending
                        ? "cursor-pointer bg-green-500 text-white hover:bg-green-600 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                        : "cursor-not-allowed bg-gray-300 text-gray-500 opacity-60"
                    }`}
                  >
                    {item.cost}P
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {purchaseMutation.isError && (
        <p className="text-center text-xs font-bold text-red-600">
          {purchaseMutation.error instanceof Error
            ? purchaseMutation.error.message.includes("포인트") ||
              purchaseMutation.error.message.includes("points")
              ? t(($) => $.store.notEnoughPoints)
              : t(($) => $.store.buyFailed)
            : t(($) => $.store.buyFailed)}
        </p>
      )}

      <p className="text-center text-xs text-amber-600/70">
        {t(($) => $.store.notice)}
      </p>
    </div>
  );
}
