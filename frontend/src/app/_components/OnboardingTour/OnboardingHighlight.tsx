"use client";

import { useLayoutEffect, useState, useMemo } from "react";

interface OnboardingHighlightProps {
  selector: string | null;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// DOM 요소의 위치를 가져오는 헬퍼 함수
function getElementRect(selector: string | null): HighlightRect | null {
  if (!selector) return null;
  const element = document.querySelector(selector);
  if (!element) return null;
  const domRect = element.getBoundingClientRect();
  return {
    top: domRect.top,
    left: domRect.left,
    width: domRect.width,
    height: domRect.height,
  };
}

export default function OnboardingHighlight({
  selector,
}: OnboardingHighlightProps) {
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // selector나 updateTrigger가 변경될 때 rect 재계산
  const rect = useMemo(() => {
    // updateTrigger를 의존성에 포함하여 강제 재계산
    void updateTrigger;
    return getElementRect(selector);
  }, [selector, updateTrigger]);

  // 리사이즈/스크롤 이벤트 구독
  useLayoutEffect(() => {
    if (!selector) return;

    const handleUpdate = () => {
      // 상태를 변경하여 useMemo 재실행 트리거
      setUpdateTrigger((prev) => prev + 1);
    };

    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);

    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [selector]);

  // 하이라이트 대상이 없으면 약한 오버레이만 표시
  if (!selector) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[99]">
        <div className="absolute inset-0 bg-black/80" />
        {/* 하단 대화창 영역은 클릭 가능하도록 제외 */}
        <div
          className="absolute right-0 bottom-0 left-0 h-64 bg-transparent"
          style={{ pointerEvents: "none" }}
        />
      </div>
    );
  }

  // 대상 요소를 찾지 못한 경우
  if (!rect) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[99]">
        <div className="absolute inset-0 bg-black/80" />
      </div>
    );
  }

  const padding = 10;

  return (
    <div className="pointer-events-none fixed inset-0 z-[99]">
      {/* 어두운 오버레이 - 4개 조각으로 나누어 하이라이트 영역을 비움 */}
      {/* 위쪽 */}
      <div
        className="absolute bg-black/80"
        style={{
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(0, rect.top - padding),
        }}
      />
      {/* 아래쪽 */}
      <div
        className="absolute bg-black/80"
        style={{
          top: rect.top + rect.height + padding,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      {/* 왼쪽 */}
      <div
        className="absolute bg-black/80"
        style={{
          top: Math.max(0, rect.top - padding),
          left: 0,
          width: Math.max(0, rect.left - padding),
          height: rect.height + padding * 2,
        }}
      />
      {/* 오른쪽 */}
      <div
        className="absolute bg-black/80"
        style={{
          top: Math.max(0, rect.top - padding),
          left: rect.left + rect.width + padding,
          right: 0,
          height: rect.height + padding * 2,
        }}
      />

      {/* 하이라이트 테두리 */}
      <div
        className="absolute rounded-xl border-4 border-red-500"
        style={{
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
          boxShadow:
            "0 0 0 4px rgba(239, 68, 68, 0.3), 0 0 30px rgba(239, 68, 68, 0.5)",
          animation: "pulse 2s ease-in-out infinite",
        }}
      />

      {/* 화살표 포인터 */}
      <div
        className="absolute"
        style={{
          top: rect.top + rect.height + padding + 8,
          left: rect.left + rect.width / 2 - 24,
        }}
      >
        <div className="size-12 animate-bounce">
          <img src="/assets/arrow.png" alt="arrow-up" />
        </div>
      </div>
    </div>
  );
}
