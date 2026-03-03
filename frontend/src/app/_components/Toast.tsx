"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, AlertCircle } from "lucide-react";

const PIXEL_BORDER = "border-3 border-amber-900";

interface ToastProps {
  message: string;
  variant?: "success" | "error";
  duration?: number;
  onClose: () => void;
}

export default function Toast({
  message,
  variant = "success",
  duration = 3000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const fadeOutTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsVisible(false);
      fadeOutTimer.current = setTimeout(() => onCloseRef.current(), 300);
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(fadeOutTimer.current);
    };
  }, [duration]);

  return (
    <div
      className={`fixed bottom-8 left-1/2 z-[100] -translate-x-1/2 transition-all duration-300 ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <div
        className={`flex items-center gap-3 ${PIXEL_BORDER} ${variant === "error" ? "bg-red-100" : "bg-[#ffecb3]"} px-5 py-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]`}
      >
        {variant === "error" ? (
          <AlertCircle className="h-5 w-5 text-red-600" />
        ) : (
          <CheckCircle className="h-5 w-5 text-green-600" />
        )}
        <span
          className={`font-bold tracking-wide ${variant === "error" ? "text-red-900" : "text-amber-900"}`}
        >
          {message}
        </span>
      </div>
    </div>
  );
}
