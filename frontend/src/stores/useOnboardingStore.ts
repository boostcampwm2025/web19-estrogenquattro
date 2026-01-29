import { create } from "zustand";

const ONBOARDING_COMPLETED_KEY = "onboarding_completed";

interface OnboardingState {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  /** 트리거 실행 중 (배경 숨김) */
  isShowingAction: boolean;
  /** 채팅 인풋이 열린 상태인지 */
  isChatOpen: boolean;
  /** 모달이 열린 상태에서 다음 가이드 대기 중 */
  isWaitingForModalGuide: boolean;

  startOnboarding: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  checkAndStartOnboarding: () => void;
  setShowingAction: (showing: boolean) => void;
  setChatOpen: (open: boolean) => void;
  setWaitingForModalGuide: (waiting: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  isActive: false,
  currentStep: 0,
  totalSteps: 8,
  isShowingAction: false,
  isChatOpen: false,
  isWaitingForModalGuide: false,

  startOnboarding: () => {
    set({ isActive: true, currentStep: 0 });
  },

  nextStep: () => {
    const { currentStep, totalSteps, completeOnboarding } = get();
    if (currentStep < totalSteps - 1) {
      set({
        currentStep: currentStep + 1,
        isShowingAction: false,
        isChatOpen: false,
        isWaitingForModalGuide: false,
      });
    } else {
      completeOnboarding();
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({
        currentStep: currentStep - 1,
        isShowingAction: false,
        isChatOpen: false,
        isWaitingForModalGuide: false,
      });
    }
  },

  skipOnboarding: () => {
    const { completeOnboarding } = get();
    completeOnboarding();
  },

  completeOnboarding: () => {
    set({
      isActive: false,
      currentStep: 0,
      isShowingAction: false,
      isChatOpen: false,
      isWaitingForModalGuide: false,
    });
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    }
  },

  checkAndStartOnboarding: () => {
    if (typeof window !== "undefined") {
      const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY);
      if (!completed) {
        setTimeout(() => {
          set({ isActive: true, currentStep: 0 });
        }, 1500);
      }
    }
  },

  setShowingAction: (showing: boolean) => {
    set({ isShowingAction: showing });
  },

  setChatOpen: (open: boolean) => {
    set({ isChatOpen: open });
  },

  setWaitingForModalGuide: (waiting: boolean) => {
    set({ isWaitingForModalGuide: waiting });
  },
}));
