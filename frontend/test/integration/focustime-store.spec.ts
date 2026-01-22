import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SocketCallback = (response: { success: boolean; error?: string }) => void;

interface MockSocket {
  connected: boolean;
  emit: (event: string, data: unknown, callback?: SocketCallback) => void;
  lastCallback?: SocketCallback;
}

let mockSocket: MockSocket;

vi.mock("@/lib/socket", () => ({
  getSocket: () => mockSocket,
}));

describe("useFocusTimeStore 롤백", () => {
  beforeEach(async () => {
    vi.resetModules();

    mockSocket = {
      connected: true,
      emit: vi.fn(
        (_event: string, _data: unknown, callback?: SocketCallback) => {
          mockSocket.lastCallback = callback;
        },
      ),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stopFocusing 실패 시 이전 상태로 롤백된다", async () => {
    // Given: FOCUSING 상태에서 시작
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    const initialTimestamp = Date.now() - 60000; // 1분 전
    useFocusTimeStore.setState({
      status: "FOCUSING",
      isFocusTimerRunning: true,
      focusStartTimestamp: initialTimestamp,
      baseFocusSeconds: 300, // 5분
      focusTime: 360, // 6분 (5분 + 1분 경과)
      error: null,
    });

    // When: stopFocusing 호출
    useFocusTimeStore.getState().stopFocusing();

    // Then: 낙관적 업데이트로 RESTING 상태
    expect(useFocusTimeStore.getState().status).toBe("RESTING");
    expect(useFocusTimeStore.getState().isFocusTimerRunning).toBe(false);

    // When: 서버 응답 실패
    mockSocket.lastCallback?.({ success: false, error: "서버 오류" });

    // Then: 이전 상태로 롤백 (시간 연속성 유지)
    const state = useFocusTimeStore.getState();
    expect(state.status).toBe("FOCUSING");
    expect(state.isFocusTimerRunning).toBe(true);
    expect(state.focusStartTimestamp).toBe(initialTimestamp);
    expect(state.baseFocusSeconds).toBe(300);
    expect(state.error).toBe("서버 오류");
  });

  it("stopFocusing 성공 시 RESTING 상태 유지", async () => {
    // Given: FOCUSING 상태에서 시작
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    useFocusTimeStore.setState({
      status: "FOCUSING",
      isFocusTimerRunning: true,
      focusStartTimestamp: Date.now() - 60000,
      baseFocusSeconds: 300,
      focusTime: 360,
      error: null,
    });

    // When: stopFocusing 호출 및 성공 응답
    useFocusTimeStore.getState().stopFocusing();
    mockSocket.lastCallback?.({ success: true });

    // Then: RESTING 상태 유지
    const state = useFocusTimeStore.getState();
    expect(state.status).toBe("RESTING");
    expect(state.isFocusTimerRunning).toBe(false);
    expect(state.error).toBeNull();
  });

  it("이미 RESTING 상태에서 stopFocusing 호출 시 무시된다", async () => {
    // Given: RESTING 상태
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    useFocusTimeStore.setState({
      status: "RESTING",
      isFocusTimerRunning: false,
      focusStartTimestamp: null,
      baseFocusSeconds: 300,
      focusTime: 300,
      error: null,
    });

    // When: stopFocusing 호출
    useFocusTimeStore.getState().stopFocusing();

    // Then: emit이 호출되지 않음
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it("이미 FOCUSING 상태에서 startFocusing 호출 시 태스크 전환을 위해 emit된다", async () => {
    // Given: FOCUSING 상태 (태스크 전환 시나리오)
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    useFocusTimeStore.setState({
      status: "FOCUSING",
      isFocusTimerRunning: true,
      baseFocusSeconds: 0,
      serverCurrentSessionSeconds: 60,
      serverReceivedAt: Date.now() - 60000,
      error: null,
    });

    // When: 새 태스크로 startFocusing 호출
    useFocusTimeStore.getState().startFocusing("새 태스크", 123);

    // Then: emit이 호출됨 (태스크 전환)
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "focusing",
      { taskName: "새 태스크", taskId: 123 },
      expect.any(Function),
    );
  });

  it("startFocusing 실패 시 RESTING으로 롤백된다", async () => {
    // Given: RESTING 상태에서 시작
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    useFocusTimeStore.setState({
      status: "RESTING",
      isFocusTimerRunning: false,
      focusStartTimestamp: null,
      baseFocusSeconds: 0,
      focusTime: 300,
      error: null,
    });

    // When: startFocusing 호출
    useFocusTimeStore.getState().startFocusing();

    // Then: 낙관적 업데이트로 FOCUSING 상태
    expect(useFocusTimeStore.getState().status).toBe("FOCUSING");

    // When: 서버 응답 실패
    mockSocket.lastCallback?.({ success: false, error: "서버 오류" });

    // Then: RESTING으로 롤백
    const state = useFocusTimeStore.getState();
    expect(state.status).toBe("RESTING");
    expect(state.isFocusTimerRunning).toBe(false);
    expect(state.focusStartTimestamp).toBeNull();
    expect(state.error).toBe("서버 오류");
  });
});
