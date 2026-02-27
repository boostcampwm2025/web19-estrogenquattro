"use client";

import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";

const PIXEL_BORDER = "border-3 border-amber-900";

interface ToastProps {
  message: string;
  duration?: number;
  onClose: () => void;
}

export default function Toast({
  message,
  duration = 3000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 마운트 후 애니메이션 트리거
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // fade-out 후 제거
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div
        className={`flex items-center gap-3 ${PIXEL_BORDER} bg-[#ffecb3] px-5 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]`}
      >
        <CheckCircle className="h-5 w-5 text-green-600" />
        <span className="font-bold tracking-wide text-amber-900">
          {message}
        </span>
      </div>
    </div>
  );
}
