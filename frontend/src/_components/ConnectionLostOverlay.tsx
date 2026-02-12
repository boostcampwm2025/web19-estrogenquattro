"use client";

import { useTranslation } from "react-i18next";
import { useConnectionStore } from "@/stores/useConnectionStore";

export default function ConnectionLostOverlay() {
  const { t } = useTranslation("common");
  const isDisconnected = useConnectionStore((state) => state.isDisconnected);

  if (!isDisconnected) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/70">
      <p className="mb-4 text-2xl text-white">
        {t(($) => $.connectionLost)}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-lg border-2 border-green-400 px-6 py-2 text-lg text-green-400 hover:bg-green-400/10 focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
      >
        {t(($) => $.refresh)}
      </button>
    </div>
  );
}
