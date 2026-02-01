"use client";

import { useProgressStore } from "@/stores/useProgressStore";
import { useEffect, useState } from "react";
import ContributionList from "./ContributionList";

export default function ProgressBar() {
  const progress = useProgressStore((state) => state.progress);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Animate progress changes
  useEffect(() => {
    const startProgress = displayProgress;
    const targetProgress = progress;
    const duration = 300; // 300ms animation
    const startTime = Date.now();
    let animationFrameId: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Cubic ease out
      const easeOut = 1 - Math.pow(1 - t, 3);
      const currentProgress =
        startProgress + (targetProgress - startProgress) * easeOut;

      setDisplayProgress(currentProgress);

      if (t < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [progress, displayProgress]);

  const calculatedWidth = ((384 - 6) * displayProgress) / 100; // 384 - padding*2 (3*2)
  const fillWidth = displayProgress < 0.1 ? 0 : Math.max(calculatedWidth, 9);

  return (
    <div
      id="progress-bar-container"
      className="fixed top-12 left-1/2 z-[50] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {/* Progress Bar */}
      <div className="relative h-6 w-96">
        {/* Background */}
        <div className="absolute inset-0 rounded-xl border border-gray-800 bg-gray-200" />

        {/* Progress Fill */}
        {fillWidth > 0 && (
          <div
            className={`absolute top-[3px] left-[3px] h-[18px] w-[var(--fill-width)] bg-green-400 transition-[width] duration-300 ease-out ${fillWidth >= 18 ? "rounded-[9px]" : "rounded-l-[9px]"}`}
            style={{ "--fill-width": `${fillWidth}px` } as React.CSSProperties}
          />
        )}
      </div>

      {/* Contribution List */}
      <ContributionList />
    </div>
  );
}
