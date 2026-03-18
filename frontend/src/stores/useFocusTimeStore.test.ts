import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FOCUS_STATUS, useFocusTimeStore } from "./useFocusTimeStore";

type SocketCallback = (response: { success: boolean; error?: string }) => void;

const socketMocks = vi.hoisted(() => {
  let callback: SocketCallback | undefined;
  return {
    socket: {
      connected: true,
      emit: vi.fn(
        (_event: string, _payload: unknown, next?: SocketCallback) => {
          callback = next;
        },
      ),
    },
    getCallback: () => callback,
    reset: () => {
      callback = undefined;
    },
  };
});

const analyticsMocks = vi.hoisted(() => ({
  focusStart: vi.fn(),
  focusStop: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  getSocket: () => socketMocks.socket,
}));

vi.mock("@/lib/analytics", () => ({
  Analytics: analyticsMocks,
}));

describe("useFocusTimeStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-18T00:00:00.000Z"));
    vi.clearAllMocks();
    socketMocks.reset();
    socketMocks.socket.connected = true;
    useFocusTimeStore.setState({
      status: FOCUS_STATUS.RESTING,
      isFocusTimerRunning: false,
      error: null,
      baseFocusSeconds: 0,
      serverCurrentSessionSeconds: 0,
      serverReceivedAt: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("getFocusTime은 focusing 상태에서 경과 시간을 누적한다", () => {
    useFocusTimeStore.setState({
      status: FOCUS_STATUS.FOCUSING,
      baseFocusSeconds: 300,
      serverCurrentSessionSeconds: 30,
      serverReceivedAt: Date.now() - 5000,
    });

    expect(useFocusTimeStore.getState().getFocusTime()).toBe(335);

    useFocusTimeStore.setState({ status: FOCUS_STATUS.RESTING });
    expect(useFocusTimeStore.getState().getFocusTime()).toBe(300);
  });

  it("연결이 끊긴 상태에서는 시작/중지를 거부하고 에러를 남긴다", () => {
    socketMocks.socket.connected = false;

    useFocusTimeStore.getState().startFocusing("집중 작업");
    expect(useFocusTimeStore.getState().status).toBe(FOCUS_STATUS.RESTING);
    expect(useFocusTimeStore.getState().error).toBe(
      "서버와 연결되지 않았습니다. 잠시 후 다시 시도해주세요.",
    );

    useFocusTimeStore.setState({
      status: FOCUS_STATUS.FOCUSING,
      isFocusTimerRunning: true,
      error: null,
    });
    useFocusTimeStore.getState().stopFocusing();
    expect(useFocusTimeStore.getState().status).toBe(FOCUS_STATUS.FOCUSING);
    expect(useFocusTimeStore.getState().error).toBe(
      "서버와 연결되지 않았습니다. 잠시 후 다시 시도해주세요.",
    );
  });

  it("집중 시작/중지 시 낙관적 업데이트와 콜백 롤백을 처리한다", () => {
    useFocusTimeStore.getState().startFocusing("새 작업", 3);
    expect(useFocusTimeStore.getState().status).toBe(FOCUS_STATUS.FOCUSING);
    expect(useFocusTimeStore.getState().isFocusTimerRunning).toBe(true);
    expect(analyticsMocks.focusStart).toHaveBeenCalledWith("새 작업");
    expect(socketMocks.socket.emit).toHaveBeenCalledWith(
      "focusing",
      expect.objectContaining({ taskName: "새 작업", taskId: 3 }),
      expect.any(Function),
    );

    socketMocks.getCallback()?.({ success: false, error: "실패" });
    expect(useFocusTimeStore.getState().status).toBe(FOCUS_STATUS.RESTING);
    expect(useFocusTimeStore.getState().error).toBe("실패");

    useFocusTimeStore.setState({
      status: FOCUS_STATUS.FOCUSING,
      isFocusTimerRunning: true,
      baseFocusSeconds: 120,
      serverCurrentSessionSeconds: 30,
      serverReceivedAt: Date.now() - 5000,
      error: null,
    });
    useFocusTimeStore.getState().stopFocusing();
    expect(useFocusTimeStore.getState().status).toBe(FOCUS_STATUS.RESTING);
    expect(analyticsMocks.focusStop).toHaveBeenCalledWith(155);

    socketMocks.getCallback()?.({ success: false, error: "rest 실패" });
    expect(useFocusTimeStore.getState().status).toBe(FOCUS_STATUS.FOCUSING);
    expect(useFocusTimeStore.getState().error).toBe("rest 실패");
  });

  it("하위 호환성 액션과 서버 동기화를 처리한다", () => {
    useFocusTimeStore.getState().setFocusTime(42);
    useFocusTimeStore.getState().setFocusTimerRunning(true);
    expect(useFocusTimeStore.getState().baseFocusSeconds).toBe(42);
    expect(useFocusTimeStore.getState().isFocusTimerRunning).toBe(true);

    useFocusTimeStore.getState().syncFromServer({
      status: FOCUS_STATUS.FOCUSING,
      totalFocusSeconds: 80,
      currentSessionSeconds: 15,
    });
    expect(useFocusTimeStore.getState().status).toBe(FOCUS_STATUS.FOCUSING);
    expect(useFocusTimeStore.getState().serverCurrentSessionSeconds).toBe(15);
    expect(useFocusTimeStore.getState().serverReceivedAt).toBe(Date.now());

    useFocusTimeStore.getState().clearError();
    expect(useFocusTimeStore.getState().error).toBeNull();

    useFocusTimeStore.getState().resetFocusTime();
    expect(useFocusTimeStore.getState().baseFocusSeconds).toBe(0);
    expect(useFocusTimeStore.getState().serverCurrentSessionSeconds).toBe(0);
    expect(useFocusTimeStore.getState().serverReceivedAt).toBe(0);
  });
});
