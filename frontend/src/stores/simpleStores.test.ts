import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./authStore";
import { useConnectionStore } from "./useConnectionStore";
import { MODAL_TYPES, useModalStore } from "./useModalStore";
import { useOnboardingStore } from "./useOnboardingStore";
import { useProgressStore } from "./useProgressStore";
import { useContributionStore } from "./useContributionStore";
import { useRoomStore } from "./useRoomStore";

const analyticsMocks = vi.hoisted(() => ({
  authFailed: vi.fn(),
  authSuccess: vi.fn(),
  tutorialComplete: vi.fn(),
  tutorialSkip: vi.fn(),
  tutorialStart: vi.fn(),
}));

const devLoggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  Analytics: analyticsMocks,
}));

vi.mock("@/lib/devLogger", () => ({
  devLogger: devLoggerMocks,
}));

describe("simple stores", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    useConnectionStore.setState({ isDisconnected: false });
    useRoomStore.setState({ roomId: "", pendingRoomId: null });
    useContributionStore.setState({ contributions: {} });
    useProgressStore.setState({
      progress: 0,
      mapIndex: 0,
      progressThreshold: 200,
      onProgressComplete: undefined,
    });
    useModalStore.setState({ activeModal: null, userInfoPayload: null });
    useOnboardingStore.setState({
      isActive: false,
      currentStep: 0,
      totalSteps: useOnboardingStore.getState().totalSteps,
      isShowingAction: false,
      isChatOpen: false,
      isWaitingForModalGuide: false,
      modalSubStepIndex: -1,
    });
    useAuthStore.setState({
      user: null,
      isLoading: true,
      isAuthenticated: false,
    });

    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("connection, room, contribution store state를 갱신한다", () => {
    useConnectionStore.getState().setDisconnected(true);
    useRoomStore.getState().setRoomId("room-1");
    useRoomStore.getState().setPendingRoomId("room-2");
    useContributionStore.getState().setContributions({ alice: 10 });

    expect(useConnectionStore.getState().isDisconnected).toBe(true);
    expect(useRoomStore.getState().roomId).toBe("room-1");
    expect(useRoomStore.getState().pendingRoomId).toBe("room-2");
    expect(useContributionStore.getState().contributions).toEqual({
      alice: 10,
    });

    useContributionStore.getState().reset();
    expect(useContributionStore.getState().contributions).toEqual({});
  });

  it("progress store는 기준값을 넘지 않고 완료 후 초기화된다", () => {
    const onComplete = vi.fn();
    useProgressStore.getState().setOnProgressComplete(onComplete);

    useProgressStore.getState().addProgress(50);
    expect(useProgressStore.getState().getProgress()).toBe(50);

    useProgressStore.getState().addProgress(500);
    expect(useProgressStore.getState().progress).toBe(200);
    expect(onComplete).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(useProgressStore.getState().progress).toBe(0);

    useProgressStore.getState().setProgress(-10);
    expect(useProgressStore.getState().progress).toBe(0);

    useProgressStore.getState().setProgress(999);
    expect(useProgressStore.getState().progress).toBe(200);

    useProgressStore.getState().setMapIndex(99);
    expect(useProgressStore.getState().mapIndex).toBe(4);

    useProgressStore.getState().reset();
    expect(useProgressStore.getState().progress).toBe(0);
  });

  it("modal store는 user info payload를 검증하고 토글한다", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    useModalStore.getState().openModal(MODAL_TYPES.USER_INFO);
    expect(useModalStore.getState().activeModal).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    useModalStore.getState().openModal(MODAL_TYPES.USER_INFO, {
      playerId: 1,
      username: "alice",
    });
    expect(useModalStore.getState().activeModal).toBe(MODAL_TYPES.USER_INFO);
    expect(useModalStore.getState().userInfoPayload?.playerId).toBe(1);

    useModalStore
      .getState()
      .toggleModal(MODAL_TYPES.USER_INFO, { playerId: 1, username: "alice" });
    expect(useModalStore.getState().activeModal).toBeNull();

    useModalStore.getState().toggleModal(MODAL_TYPES.LEADERBOARD);
    expect(useModalStore.getState().activeModal).toBe(MODAL_TYPES.LEADERBOARD);

    useModalStore.getState().closeModal();
    expect(useModalStore.getState().userInfoPayload).toBeNull();
  });

  it("onboarding store는 시작, 다음/이전 단계, skip, 완료를 처리한다", () => {
    useOnboardingStore.getState().startOnboarding();
    expect(useOnboardingStore.getState().isActive).toBe(true);
    expect(analyticsMocks.tutorialStart).toHaveBeenCalledTimes(1);

    useOnboardingStore.setState({
      currentStep: 1,
      isShowingAction: true,
      isChatOpen: true,
      isWaitingForModalGuide: true,
      modalSubStepIndex: 3,
    });
    useOnboardingStore.getState().nextStep();
    expect(useOnboardingStore.getState().currentStep).toBe(2);
    expect(useOnboardingStore.getState().isShowingAction).toBe(false);
    expect(useOnboardingStore.getState().isChatOpen).toBe(false);
    expect(useOnboardingStore.getState().isWaitingForModalGuide).toBe(false);
    expect(useOnboardingStore.getState().modalSubStepIndex).toBe(-1);

    useOnboardingStore.getState().prevStep();
    expect(useOnboardingStore.getState().currentStep).toBe(1);

    useOnboardingStore.getState().setShowingAction(true);
    useOnboardingStore.getState().setChatOpen(true);
    useOnboardingStore.getState().setWaitingForModalGuide(true);
    useOnboardingStore.getState().nextModalSubStep();
    expect(useOnboardingStore.getState().modalSubStepIndex).toBe(0);
    useOnboardingStore.getState().resetModalSubStep();
    expect(useOnboardingStore.getState().modalSubStepIndex).toBe(-1);

    useOnboardingStore.getState().skipOnboarding();
    expect(localStorage.getItem("onboarding_completed")).toBe("true");
    expect(analyticsMocks.tutorialSkip).toHaveBeenCalledWith(1);
    expect(analyticsMocks.tutorialComplete).toHaveBeenCalledTimes(1);
    expect(useOnboardingStore.getState().isActive).toBe(false);
  });

  it("onboarding store는 미완료 상태면 지연 후 시작한다", () => {
    useOnboardingStore.getState().checkAndStartOnboarding();
    expect(useOnboardingStore.getState().isActive).toBe(false);

    vi.advanceTimersByTime(1500);
    expect(useOnboardingStore.getState().isActive).toBe(true);

    useOnboardingStore.getState().completeOnboarding();
    useOnboardingStore.setState({ isActive: false });
    useOnboardingStore.getState().checkAndStartOnboarding();
    vi.advanceTimersByTime(1500);
    expect(useOnboardingStore.getState().isActive).toBe(false);
  });

  it("auth store는 사용자 조회 성공/실패/예외를 처리한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          githubId: "1",
          username: "alice",
          avatarUrl: "avatar",
          playerId: 7,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      .mockRejectedValueOnce(new Error("network"));

    vi.stubGlobal("fetch", fetchMock);

    await useAuthStore.getState().fetchUser();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.playerId).toBe(7);
    expect(analyticsMocks.authSuccess).toHaveBeenCalledTimes(1);

    await useAuthStore.getState().fetchUser();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(analyticsMocks.authFailed).toHaveBeenCalledWith("http_401");

    await useAuthStore.getState().fetchUser();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(devLoggerMocks.error).toHaveBeenCalled();
    expect(analyticsMocks.authFailed).toHaveBeenCalledWith("network_error");
  });
});
