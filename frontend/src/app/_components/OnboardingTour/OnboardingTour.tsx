"use client";

import { useEffect, useCallback, useRef } from "react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useModalStore } from "@/stores/useModalStore";
import { ONBOARDING_STEPS, type OnboardingMessageKey } from "./onboardingSteps";
import DialogBox from "./DialogBox";
import OnboardingHighlight from "./OnboardingHighlight";

const tDynamic = (key: OnboardingMessageKey): string =>
  (i18next.t as unknown as (k: string, opts: { ns: string }) => string)(key, {
    ns: "onboarding",
  });

export default function OnboardingTour() {
  const { t } = useTranslation("onboarding");

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
    modalSubStepIndex,
    nextModalSubStep,
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

  // 현재 서브 스텝 정보 가져오기
  const getCurrentSubStep = () => {
    if (!isWaitingForModalGuide || !step) return null;

    // modalSubStepIndex가 -1이면 afterModal 단계
    if (modalSubStepIndex === -1) {
      return {
        highlight: step.afterModalHighlight ?? null,
        messageKey: step.afterModalMessageKey ?? step.messageKey,
        triggerType: "manual" as const,
        triggerTarget: undefined,
      };
    }

    // modalSubSteps가 있으면 해당 인덱스의 서브 스텝 반환
    if (step.modalSubSteps && modalSubStepIndex < step.modalSubSteps.length) {
      return step.modalSubSteps[modalSubStepIndex];
    }

    return null;
  };

  const currentSubStep = getCurrentSubStep();

  // (펫 투어 단계)에서 다음으로 넘어갈 때 모달 닫기
  const handleNextWithModalClose = useCallback(() => {
    // 모달 가이드 중이고 서브 스텝이 있는 경우
    if (isWaitingForModalGuide && step.modalSubSteps) {
      const nextSubIndex = modalSubStepIndex + 1;
      if (nextSubIndex < step.modalSubSteps.length) {
        // 다음 서브 스텝으로
        nextModalSubStep();
        return;
      }
    }

    // 펫 투어 단계에서 다음으로 넘어갈 때 모달 닫기
    if (step.id === "pet") {
      closeModal();
    }
    nextStep();
  }, [
    step,
    closeModal,
    nextStep,
    isWaitingForModalGuide,
    modalSubStepIndex,
    nextModalSubStep,
  ]);

  // 이전 버튼 핸들러 - 모달이 열려있으면 닫기
  const handlePrevWithModalClose = useCallback(() => {
    // 모달 가이드 중이거나 모달 관련 스텝에서 이전으로 가면 모달 닫기
    if (
      isWaitingForModalGuide ||
      step.id === "pet" ||
      step.id === "character"
    ) {
      closeModal();
      setWaitingForModalGuide(false);
    }
    prevStep();
  }, [
    step,
    closeModal,
    prevStep,
    isWaitingForModalGuide,
    setWaitingForModalGuide,
  ]);

  // 키보드 이벤트 핸들러 - 트리거 외 모든 이벤트 차단
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive || !step) return;

      // 방향키/WASD 트리거 스텝
      if (
        step.triggerType === "keypress" &&
        Array.isArray(step.triggerTarget)
      ) {
        // e.code를 사용하여 물리적 키 위치로 비교 (한글 키보드에서도 동작)
        if (step.triggerTarget.includes(e.code)) {
          setShowingAction(true);

          if (actionTimeoutRef.current) {
            clearTimeout(actionTimeoutRef.current);
          }
          actionTimeoutRef.current = setTimeout(() => {
            nextStep();
          }, 1000);
          return;
        }
        // triggerTarget에 없는 키만 차단 (방향키/WASD 외 다른 키)
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 채팅 트리거 스텝
      if (step.triggerType === "chat") {
        if (e.key === "Enter") {
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
          return;
        }
        // 채팅 중일 때는 다른 키 허용 (타이핑을 위해)
        if (isChatOpen) return;
      }

      // 그 외 모든 키 이벤트 차단
      e.preventDefault();
      e.stopPropagation();
    },
    [isActive, step, nextStep, setShowingAction, isChatOpen, setChatOpen],
  );

  // 클릭 이벤트 핸들러 - 트리거 외 모든 클릭 차단
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!isActive || !step) return;

      const target = e.target as HTMLElement;

      // 대화창 버튼 클릭은 항상 허용 (건너뛰기, 이전, 다음 버튼)
      const dialogBox = document.querySelector(
        '[class*="fixed right-0 bottom-0 left-0 z-\\[100\\]"]',
      );
      if (dialogBox && dialogBox.contains(target)) {
        return; // 대화창 내부 클릭은 허용
      }

      // 연결 끊김 오버레이 클릭은 항상 허용 (서버 문제는 온보딩보다 우선)
      if (target.closest('[class*="z-[110]"]')) {
        return;
      }

      // 트리거 대상 확인용 헬퍼 함수
      const isClickOnTrigger = (selector: string | undefined) => {
        if (!selector) return false;
        const triggerElement = document.querySelector(selector);
        return (
          triggerElement &&
          (triggerElement === target || triggerElement.contains(target))
        );
      };

      // 모달 서브 스텝 클릭 처리
      if (isWaitingForModalGuide && currentSubStep?.triggerType === "click") {
        const triggerSelector = currentSubStep.triggerTarget;
        if (isClickOnTrigger(triggerSelector)) {
          setShowingAction(true);

          if (actionTimeoutRef.current) {
            clearTimeout(actionTimeoutRef.current);
          }

          // 서브 스텝이 더 있는지 확인
          const nextSubIndex = modalSubStepIndex + 1;
          const hasMoreSubSteps =
            step.modalSubSteps && nextSubIndex < step.modalSubSteps.length;

          // 현재 서브 스텝의 딜레이 설정 (기본 500ms)
          const delay = currentSubStep.delayAfterClick ?? 500;

          actionTimeoutRef.current = setTimeout(() => {
            setShowingAction(false);
            if (hasMoreSubSteps) {
              // 다음 서브 스텝으로 이동하기 전에 scrollIntoView 처리
              const nextSubStep = step.modalSubSteps![nextSubIndex];
              if (nextSubStep.scrollIntoView && nextSubStep.triggerTarget) {
                setTimeout(() => {
                  const element = document.querySelector(
                    nextSubStep.triggerTarget!,
                  );
                  if (element) {
                    element.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }
                }, 100);
              }
              nextModalSubStep();
            } else {
              // 모든 서브 스텝 완료, 다음 메인 스텝으로
              setWaitingForModalGuide(false);
              nextStep();
            }
          }, delay);
          return;
        }
        // 트리거 아닌 클릭 차단
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 일반 클릭 트리거 (리더보드 버튼 등)
      if (
        step.triggerType === "click" &&
        typeof step.triggerTarget === "string"
      ) {
        if (isClickOnTrigger(step.triggerTarget)) {
          setShowingAction(true);

          if (actionTimeoutRef.current) {
            clearTimeout(actionTimeoutRef.current);
          }
          actionTimeoutRef.current = setTimeout(() => {
            // 리더보드 모달 닫기
            closeModal();
            nextStep();
          }, 2000);
          return;
        }
        // 트리거 아닌 클릭 차단
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 모달 클릭 트리거 (유저 정보 버튼)
      if (
        step.triggerType === "modal-click" &&
        typeof step.triggerTarget === "string" &&
        !isWaitingForModalGuide
      ) {
        if (isClickOnTrigger(step.triggerTarget)) {
          setShowingAction(true);

          // 모달이 열리는 것을 기다린 후 다음 가이드 표시
          if (actionTimeoutRef.current) {
            clearTimeout(actionTimeoutRef.current);
          }
          actionTimeoutRef.current = setTimeout(() => {
            setShowingAction(false);
            setWaitingForModalGuide(true);
          }, 500);
          return;
        }
        // 트리거 아닌 클릭 차단
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // manual 타입이나 다른 타입에서도 기본적으로 클릭 이벤트 차단 (대화창 버튼 제외)
      e.preventDefault();
      e.stopPropagation();
    },
    [
      isActive,
      step,
      nextStep,
      setShowingAction,
      closeModal,
      isWaitingForModalGuide,
      setWaitingForModalGuide,
      currentSubStep,
      modalSubStepIndex,
      nextModalSubStep,
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
  const isWaitingForTrigger = () => {
    if (isWaitingForModalGuide && currentSubStep) {
      return currentSubStep.triggerType === "click";
    }
    return step.triggerType !== "manual";
  };

  // 트리거 힌트 메시지 생성 (고정 키 → selector 방식)
  const getTriggerHint = () => {
    if (isWaitingForModalGuide && currentSubStep?.triggerType === "click") {
      if (currentSubStep.triggerTarget === "#pet-tab-button") {
        return t((r) => r.hints.clickPetTab);
      }
      if (currentSubStep.triggerTarget === "#pet-gacha-button") {
        return t((r) => r.hints.clickPetGacha);
      }
      return t((r) => r.hints.clickButton);
    }

    switch (step.triggerType) {
      case "keypress":
        return t((r) => r.hints.keypress);
      case "chat":
        return isChatOpen
          ? t((r) => r.hints.chatClose)
          : t((r) => r.hints.chatOpen);
      case "click":
        if (step.triggerTarget === "#channel-select-button") {
          return t((r) => r.hints.clickChannel);
        }
        return t((r) => r.hints.clickButton);
      case "modal-click":
        return t((r) => r.hints.clickUserInfo);
      default:
        return undefined;
    }
  };

  // 액션 중이면 대화창과 하이라이트 숨김
  if (isShowingAction) {
    return null;
  }

  // 현재 하이라이트와 메시지 결정
  const currentHighlight =
    isWaitingForModalGuide && currentSubStep
      ? currentSubStep.highlight
      : step.highlight;

  const currentMessageKey =
    isWaitingForModalGuide && currentSubStep
      ? currentSubStep.messageKey
      : step.messageKey;

  return (
    <>
      <OnboardingHighlight selector={currentHighlight} />
      <DialogBox
        message={tDynamic(currentMessageKey)}
        currentStep={currentStep}
        totalSteps={totalSteps}
        onNext={handleNextWithModalClose}
        onPrev={handlePrevWithModalClose}
        onSkip={skipOnboarding}
        isFirstStep={currentStep === 0}
        isLastStep={currentStep === totalSteps - 1}
        isWaitingForTrigger={isWaitingForTrigger()}
        triggerHint={getTriggerHint()}
      />
    </>
  );
}
