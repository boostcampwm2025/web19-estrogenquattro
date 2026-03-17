import { beforeEach, describe, expect, it, vi } from "vitest";

const tutorialStartSpy = vi.fn();
const tutorialSkipSpy = vi.fn();
const tutorialCompleteSpy = vi.fn();

vi.mock("@/lib/analytics", () => ({
  Analytics: {
    tutorialStart: tutorialStartSpy,
    tutorialSkip: tutorialSkipSpy,
    tutorialComplete: tutorialCompleteSpy,
  },
}));

const createStorageMock = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
};

describe("useOnboardingStore 통합", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    const localStorage = createStorageMock();
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("localStorage", localStorage);
  });

  it("onboarding이 완료되지 않았으면 지연 후 자동 시작한다", async () => {
    // Given
    vi.resetModules();
    const { useOnboardingStore } = await import("@/stores/useOnboardingStore");

    // When
    useOnboardingStore.getState().checkAndStartOnboarding();
    vi.advanceTimersByTime(1499);

    // Then
    expect(useOnboardingStore.getState().isActive).toBe(false);

    // When
    vi.advanceTimersByTime(1);

    // Then
    expect(useOnboardingStore.getState().isActive).toBe(true);
    expect(useOnboardingStore.getState().currentStep).toBe(0);
  });

  it("completeOnboarding은 상태를 초기화하고 localStorage에 완료 플래그를 저장한다", async () => {
    // Given
    vi.resetModules();
    const { useOnboardingStore } = await import("@/stores/useOnboardingStore");
    useOnboardingStore.setState({
      isActive: true,
      currentStep: 2,
      totalSteps: 5,
      isShowingAction: true,
      isChatOpen: true,
      isWaitingForModalGuide: true,
      modalSubStepIndex: 1,
    });

    // When
    useOnboardingStore.getState().completeOnboarding();

    // Then
    const state = useOnboardingStore.getState();
    expect(state.isActive).toBe(false);
    expect(state.currentStep).toBe(0);
    expect(state.modalSubStepIndex).toBe(-1);
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "onboarding_completed",
      "true",
    );
    expect(tutorialCompleteSpy).toHaveBeenCalled();
  });

  it("skipOnboarding은 현재 step을 기록하고 완료 처리한다", async () => {
    // Given
    vi.resetModules();
    const { useOnboardingStore } = await import("@/stores/useOnboardingStore");
    useOnboardingStore.setState({
      isActive: true,
      currentStep: 3,
      totalSteps: 5,
      isShowingAction: false,
      isChatOpen: false,
      isWaitingForModalGuide: false,
      modalSubStepIndex: -1,
    });

    // When
    useOnboardingStore.getState().skipOnboarding();

    // Then
    expect(tutorialSkipSpy).toHaveBeenCalledWith(3);
    expect(useOnboardingStore.getState().isActive).toBe(false);
  });
});
