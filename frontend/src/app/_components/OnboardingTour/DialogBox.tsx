"use client";

import Image from "next/image";

interface DialogBoxProps {
  message: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isWaitingForTrigger: boolean;
  triggerHint?: string;
}

export default function DialogBox({
  message,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  isFirstStep,
  isLastStep,
  isWaitingForTrigger,
  triggerHint,
}: DialogBoxProps) {
  return (
    <div className="fixed right-0 bottom-0 left-0 z-[100] px-4 pb-4 md:px-8 lg:px-16">
      {/* 대화창 컨테이너 - 캐릭터 이미지를 위한 왼쪽 패딩 */}
      <div className="relative mx-auto max-w-[1200px]">
        <div className="absolute top-1/2 -left-4 z-10 -translate-y-1/2">
          <Image
            src="/assets/mascot/tutorial_man1.png"
            alt="튜토리얼 마스코트"
            width={300}
            height={300}
            className="h-56 w-56 object-contain drop-shadow-lg"
            priority
          />
        </div>

        {/* 대화창 - 왼쪽에 캐릭터 공간 확보 */}
        <div className="relative flex min-h-[250px] flex-col rounded-lg border-4 border-amber-900 bg-gradient-to-b from-[#fff8e1] to-[#ffecb3] p-4 pl-44 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.4)] md:p-5 md:pl-52 lg:p-6 lg:pl-60">
          {/* 스텝 인디케이터 */}
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-amber-600 px-2 py-0.5 font-bold text-white">
              젠킨수
            </span>
            <span className="text-xs text-amber-600">
              ({currentStep + 1}/{totalSteps})
            </span>
          </div>

          <div className="flex-1">
            {/* 메시지 */}
            <p className="mb-4 text-base leading-relaxed font-medium text-amber-900 md:text-lg">
              {message.split("<br>").map((line, index, arr) => (
                <span key={index}>
                  {line}
                  {index < arr.length - 1 && <br />}
                </span>
              ))}
            </p>

            {/* 트리거 힌트 (인터랙티브 스텝일 때) */}
            {isWaitingForTrigger && triggerHint && (
              <div className="mb-3 animate-pulse rounded bg-amber-100 text-xl text-amber-700">
                💡 {triggerHint}
              </div>
            )}
          </div>

          {/* 버튼 영역 - 항상 하단에 위치 */}
          <div className="mt-auto flex items-center justify-between">
            <button
              onClick={onSkip}
              className="cursor-pointer text-sm text-amber-600 underline transition-colors hover:text-amber-800"
            >
              건너뛰기
            </button>

            <div className="flex gap-2">
              {!isFirstStep && (
                <button
                  onClick={onPrev}
                  className="cursor-pointer rounded border-3 border-amber-900 bg-amber-200 px-4 py-2 text-sm font-bold text-amber-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] transition-all hover:bg-amber-300 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  ◀ 이전
                </button>
              )}
              {!isWaitingForTrigger && (
                <button
                  onClick={onNext}
                  className="cursor-pointer rounded border-3 border-amber-900 bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] transition-all hover:bg-amber-700 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  {isLastStep ? "시작하기!" : "다음 ▶"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
