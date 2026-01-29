"use client";

import { useEffect, useCallback, useRef } from "react";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useModalStore } from "@/stores/useModalStore";
import { ONBOARDING_STEPS } from "./onboardingSteps";
import DialogBox from "./DialogBox";
import OnboardingHighlight from "./OnboardingHighlight";

export default function OnboardingTour() {
  const {
    isActive,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    skipOnboarding,
    checkAndStartOnboarding,
    isShowingAction,
    setShowingAction,
    isChatOpen,
    setChatOpen,
    isWaitingForModalGuide,
    setWaitingForModalGuide,
  } = useOnboardingStore();

  const { closeModal } = useModalStore();

  const actionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    checkAndStartOnboarding();
  }, [checkAndStartOnboarding]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current);
      }
    };
  }, []);

  const step = ONBOARDING_STEPS[currentStep];

  // (펫 투어 단계)에서 다음으로 넘어갈 때 모달 닫기
  const handleNextWithModalClose = useCallback(() => {
    // 펫 투어 단계에서 다음으로 넘어갈 때 모달 닫기
    if (step.id === "pet") {
      closeModal();
    }
    nextStep();
  }, [step, closeModal, nextStep]);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive || !step) return;

      // 채팅 스텝이 아닐 때 엔터 차단
      if (e.key === "Enter" && step.triggerType !== "chat") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 방향키 트리거
      if (
        step.triggerType === "keypress" &&
        Array.isArray(step.triggerTarget)
      ) {
        if (step.triggerTarget.includes(e.key)) {
          setShowingAction(true);

          if (actionTimeoutRef.current) {
            clearTimeout(actionTimeoutRef.current);
          }
          actionTimeoutRef.current = setTimeout(() => {
            nextStep();
          }, 2000);
        }
      }

      // 채팅 트리거
      if (step.triggerType === "chat" && e.key === "Enter") {
        if (!isChatOpen) {
          setChatOpen(true);
          setShowingAction(true);
        } else {
          setShowingAction(false);
          setChatOpen(false);

          if (actionTimeoutRef.current) {
            clearTimeout(actionTimeoutRef.current);
          }
          actionTimeoutRef.current = setTimeout(() => {
            nextStep();
          }, 500);
        }
      }
    },
    [isActive, step, nextStep, setShowingAction, isChatOpen, setChatOpen],
  );

  // 클릭 이벤트 핸들러
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!isActive || !step) return;

      const target = e.target as HTMLElement;

      // 모달 내부 펫 탭 클릭 트리거 (먼저 체크해서 modal-click보다 우선 처리)
      if (isWaitingForModalGuide && step.afterModalHighlight) {
        const petTabButton = document.querySelector(step.afterModalHighlight);

        if (
          petTabButton &&
          (petTabButton === target || petTabButton.contains(target))
        ) {
          // 배경 숨기고 잠시 후 다음 스텝으로 (UI 깜빡임 방지)
          setShowingAction(true);
          setWaitingForModalGuide(false);

          if (actionTimeoutRef.current) {
            clearTimeout(actionTimeoutRef.current);
          }
          actionTimeoutRef.current = setTimeout(() => {
            setShowingAction(false);
            nextStep();
          }, 300);
          return; // 다른 핸들러 실행 방지
        }
      }

      // 일반 클릭 트리거 (리더보드 버튼 등)
      if (
        step.triggerType === "click" &&
        typeof step.triggerTarget === "string"
      ) {
        const triggerElement = document.querySelector(step.triggerTarget);

        if (
          triggerElement &&
          (triggerElement === target || triggerElement.contains(target))
        ) {
          setShowingAction(true);

          if (actionTimeoutRef.current) {
            clearTimeout(actionTimeoutRef.current);
          }
          actionTimeoutRef.current = setTimeout(() => {
            // 리더보드 모달 닫기
            closeModal();
            nextStep();
          }, 2000);
        }
      }

      // 모달 클릭 트리거 (유저 정보 버튼)
      if (
        step.triggerType === "modal-click" &&
        typeof step.triggerTarget === "string" &&
        !isWaitingForModalGuide
      ) {
        const triggerElement = document.querySelector(step.triggerTarget);

        if (
          triggerElement &&
          (triggerElement === target || triggerElement.contains(target))
        ) {
          setShowingAction(true);

          // 모달이 열리는 것을 기다린 후 다음 가이드 표시
          if (actionTimeoutRef.current) {
            clearTimeout(actionTimeoutRef.current);
          }
          actionTimeoutRef.current = setTimeout(() => {
            setShowingAction(false);
            setWaitingForModalGuide(true);
          }, 500);
        }
      }
    },
    [
      isActive,
      step,
      nextStep,
      setShowingAction,
      closeModal,
      isWaitingForModalGuide,
      setWaitingForModalGuide,
    ],
  );

  // 이벤트 리스너 등록
  useEffect(() => {
    if (!isActive) return;

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("click", handleClick, true);
    };
  }, [isActive, handleKeyDown, handleClick]);

  if (!isActive) {
    return null;
  }

  // 현재 스텝이 트리거 대기 중인지 확인
  const isWaitingForTrigger =
    step.triggerType !== "manual" && !isWaitingForModalGuide;

  // 트리거 힌트 메시지 생성
  const getTriggerHint = () => {
    if (isWaitingForModalGuide) {
      return "펫 탭을 클릭해보세요!";
    }

    switch (step.triggerType) {
      case "keypress":
        return "방향키를 눌러보세요!";
      case "chat":
        return isChatOpen
          ? "메시지를 입력하고 엔터를 눌러 채팅창을 닫아보세요!"
          : "엔터 키를 눌러 채팅창을 열어보세요!";
      case "click":
        return "해당 버튼을 클릭해보세요!";
      case "modal-click":
        return "유저 정보 버튼을 클릭해보세요!";
      default:
        return undefined;
    }
  };

  // 액션 중이면 대화창과 하이라이트 숨김
  if (isShowingAction) {
    return null;
  }

  // 모달 가이드 대기 중이면 펫 탭 하이라이트
  const currentHighlight = isWaitingForModalGuide
    ? (step.afterModalHighlight ?? null)
    : step.highlight;

  const currentMessage = isWaitingForModalGuide
    ? (step.afterModalMessage ?? step.message)
    : step.message;

  return (
    <>
      <OnboardingHighlight selector={currentHighlight} />
      <DialogBox
        message={currentMessage}
        currentStep={currentStep}
        totalSteps={totalSteps}
        onNext={handleNextWithModalClose}
        onPrev={prevStep}
        onSkip={skipOnboarding}
        isFirstStep={currentStep === 0}
        isLastStep={currentStep === totalSteps - 1}
        isWaitingForTrigger={isWaitingForTrigger || isWaitingForModalGuide}
        triggerHint={getTriggerHint()}
      />
    </>
  );
}
