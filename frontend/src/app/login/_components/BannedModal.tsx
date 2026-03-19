"use client";

import { useEffect, useState } from "react";
import { ShieldBan } from "lucide-react";

const PIXEL_BORDER = "border-3 border-amber-900";

interface BannedModalProps {
  reason: string | null;
  onClose: () => void;
}

export default function BannedModal({ reason, onClose }: BannedModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center transition-all duration-300 ${
        isVisible ? "bg-black/50" : "bg-black/0"
      }`}
      onClick={handleClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="banned-modal-title"
    >
      <div
        className={`w-80 ${PIXEL_BORDER} bg-red-100 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transition-all duration-300 ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          <ShieldBan className="h-6 w-6 text-red-600" />
          <h2 id="banned-modal-title" className="text-lg font-bold tracking-wide text-red-900">
            계정이 정지되었습니다
          </h2>
        </div>
        {reason && (
          <div className="mb-3 rounded bg-red-200/50 px-3 py-2">
            <p className="text-sm font-bold text-red-900">사유: {reason}</p>
          </div>
        )}
        <p className="mb-5 text-sm text-red-800">
          문의 사항이 있으시면 관리자에게 연락해주세요.
        </p>
        <div className="flex justify-end">
          <button
            onClick={handleClose}
            autoFocus
            className={`cursor-pointer ${PIXEL_BORDER} bg-[#ffecb3] px-5 py-2 font-bold tracking-wide text-amber-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] transition-all hover:brightness-95 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none`}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
