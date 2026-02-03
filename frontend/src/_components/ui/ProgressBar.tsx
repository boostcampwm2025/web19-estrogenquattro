"use client";

import { useProgressStore } from "@/stores/useProgressStore";
import { useEffect, useState } from "react";
import ContributionList from "./ContributionList";

const SECTION_COUNT = 24;
const TOTAL_STAGES = 5;

export default function ProgressBar() {
  const progress = useProgressStore((state) => state.progress);
  const mapIndex = useProgressStore((state) => state.mapIndex);
  const progressThreshold = useProgressStore((state) => state.progressThreshold);
  const [displayProgress, setDisplayProgress] = useState(0);

  // 현재 스테이지 (1-indexed)
  const currentStage = mapIndex + 1;
  const isLastMap = mapIndex >= 4;

  // Animate progress changes
  useEffect(() => {
    const startProgress = displayProgress;
    const targetProgress = progress;
    const duration = 300;
    const startTime = Date.now();
    let animationFrameId: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - t, 3);
      const currentProgress =
        startProgress + (targetProgress - startProgress) * easeOut;

      // 애니메이션 완료 시 정확한 값으로 설정
      if (t >= 1) {
        setDisplayProgress(targetProgress);
      } else {
        setDisplayProgress(currentProgress);
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [progress]); // displayProgress 의존성 제거 (무한 루프 방지)

  // 기준값 기반으로 퍼센트 계산 (마지막 맵은 항상 100%)
  const progressPercent = isLastMap
    ? 100
    : Math.min((displayProgress / progressThreshold) * 100, 100);

  // 몇 개의 섹션이 채워져야 하는지 계산
  const filledSections = Math.floor((progressPercent / 100) * SECTION_COUNT);
  const partialFill =
    ((progressPercent / 100) * SECTION_COUNT - filledSections) * 100;

  // 라벨 텍스트 결정 (마지막 맵은 항상 STAGE COMPLETE!)
  const labelText = isLastMap
    ? "STAGE COMPLETE!"
    : `NEXT STAGE LOADING... (${currentStage}/${TOTAL_STAGES})`;

  return (
    <div
      id="progress-bar-container"
      className="fixed top-4 left-1/2 z-[50] flex -translate-x-1/2 flex-col items-center"
    >
      {/* Label */}
      <span
        className="font-neodunggeunmo text-xl font-bold text-white"
        style={{
          textShadow: `
            -1px -1px 0 black,
            1px -1px 0 black,
            -1px 1px 0 black,
            1px 1px 0 black
          `,
        }}
      >
        {labelText}
      </span>

      {/* Pixel Art Progress Bar with rounded corners */}
      <div className="relative flex items-center">
        {/* Left pixel rounded corner - 4 step radius */}
        <div className="flex flex-col">
          <div className="h-[4px] w-[4px] bg-transparent" />
          <div className="h-[4px] w-[4px] bg-transparent" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-transparent" />
          <div className="h-[4px] w-[4px] bg-transparent" />
        </div>
        <div className="flex flex-col">
          <div className="h-[4px] w-[4px] bg-transparent" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-transparent" />
        </div>
        <div className="flex flex-col">
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-black" />
        </div>
        <div className="flex flex-col" style={{ marginLeft: "-5px" }}>
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-black" />
        </div>

        {/* Main bar body */}
        <div className="flex flex-col">
          {/* Top border */}
          <div
            className="h-[4px] bg-black"
            style={{
              width: `${SECTION_COUNT * 9 + (SECTION_COUNT - 1) * 3}px`,
            }}
          />

          {/* Progress area with sections */}
          <div className="flex h-[24px] items-center gap-[3px] bg-white">
            {Array.from({ length: SECTION_COUNT }).map((_, i) => {
              let fillPercent = 0;

              // 100%일 때 모든 섹션 채움
              if (progressPercent >= 100) {
                fillPercent = 100;
              } else if (progressPercent <= 0) {
                // 0%일 때 모든 섹션 비움
                fillPercent = 0;
              } else if (i < filledSections) {
                fillPercent = 100;
              } else if (i === filledSections) {
                fillPercent = partialFill;
              }

              return (
                <div
                  key={i}
                  className="relative h-[16px] w-[9px] overflow-hidden bg-white"
                >
                  <div
                    className="absolute inset-0 transition-all duration-150"
                    style={{
                      width: `${fillPercent}%`,
                      backgroundColor: "#22c55e",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Bottom border */}
          <div
            className="h-[4px] bg-black"
            style={{
              width: `${SECTION_COUNT * 9 + (SECTION_COUNT - 1) * 3}px`,
            }}
          />
        </div>

        {/* Right pixel rounded corner - 4 step radius */}
        <div className="flex flex-col" style={{ marginLeft: "-5px" }}>
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-black" />
        </div>
        <div className="flex flex-col">
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-black" />
        </div>
        <div className="flex flex-col">
          <div className="h-[4px] w-[4px] bg-transparent" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-white" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-transparent" />
        </div>
        <div className="flex flex-col">
          <div className="h-[4px] w-[4px] bg-transparent" />
          <div className="h-[4px] w-[4px] bg-transparent" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-black" />
          <div className="h-[4px] w-[4px] bg-transparent" />
          <div className="h-[4px] w-[4px] bg-transparent" />
        </div>
      </div>
      <ContributionList />
    </div>
  );
}
