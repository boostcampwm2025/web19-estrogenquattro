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
      baseFocusSeconds: 300, // 5분
      serverCurrentSessionSeconds: 60, // 1분 경과
      serverReceivedAt: initialTimestamp,
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
    expect(state.serverReceivedAt).toBe(initialTimestamp);
    expect(state.baseFocusSeconds).toBe(300);
    expect(state.error).toBe("서버 오류");
  });

  it("stopFocusing 성공 시 RESTING 상태 유지", async () => {
    // Given: FOCUSING 상태에서 시작
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    useFocusTimeStore.setState({
      status: "FOCUSING",
      isFocusTimerRunning: true,
      baseFocusSeconds: 300,
      serverCurrentSessionSeconds: 60,
      serverReceivedAt: Date.now() - 60000,
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
      baseFocusSeconds: 300,
      serverCurrentSessionSeconds: 0,
      serverReceivedAt: 0,
      error: null,
    });

    // When: stopFocusing 호출
    useFocusTimeStore.getState().stopFocusing();

    // Then: emit이 호출되지 않음
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it("이미 FOCUSING 상태에서 taskId 없이 startFocusing 호출 시 무시된다", async () => {
    // Given: FOCUSING 상태
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    useFocusTimeStore.setState({
      status: "FOCUSING",
      isFocusTimerRunning: true,
      baseFocusSeconds: 0,
      serverCurrentSessionSeconds: 60,
      serverReceivedAt: Date.now() - 60000,
      error: null,
    });

    // When: taskId 없이 startFocusing 호출
    useFocusTimeStore.getState().startFocusing();

    // Then: emit이 호출됨 (무시됨)
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it("Task A에서 Task B로 전환 시 focusing 이벤트가 전송된다", async () => {
    // Given: Task A로 집중 중인 상태
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    useFocusTimeStore.setState({
      status: "FOCUSING",
      isFocusTimerRunning: true,
      baseFocusSeconds: 0,
      serverCurrentSessionSeconds: 300, // 5분 경과
      serverReceivedAt: Date.now() - 300000,
      error: null,
    });

    // When: Task B로 전환 (taskId 포함)
    useFocusTimeStore.getState().startFocusing("Task B", 2);

    // Then: focusing 이벤트가 전송됨
    expect(mockSocket.emit).toHaveBeenCalledWith(
      "focusing",
      { taskName: "Task B", taskId: 2, startAt: expect.any(String) },
      expect.any(Function),
    );
  });

  it("Task 전환 시 낙관적 업데이트가 적용된다", async () => {
    // Given: Task A로 집중 중인 상태
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    const initialTimestamp = Date.now() - 300000;
    useFocusTimeStore.setState({
      status: "FOCUSING",
      isFocusTimerRunning: true,
      baseFocusSeconds: 0,
      serverCurrentSessionSeconds: 300,
      serverReceivedAt: initialTimestamp,
      error: null,
    });

    // When: Task B로 전환
    useFocusTimeStore.getState().startFocusing("Task B", 2);

    // Then: 상태가 FOCUSING 유지, serverReceivedAt 갱신
    const state = useFocusTimeStore.getState();
    expect(state.status).toBe("FOCUSING");
    expect(state.isFocusTimerRunning).toBe(true);
    expect(state.serverReceivedAt).not.toBe(initialTimestamp); // 새 타임스탬프
    expect(state.serverReceivedAt).toBeGreaterThan(initialTimestamp);
  });

  it("startFocusing 실패 시 RESTING으로 롤백된다", async () => {
    // Given: RESTING 상태에서 시작
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    useFocusTimeStore.setState({
      status: "RESTING",
      isFocusTimerRunning: false,
      baseFocusSeconds: 300,
      serverCurrentSessionSeconds: 0,
      serverReceivedAt: 0,
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
    expect(state.serverReceivedAt).toBe(0);
    expect(state.error).toBe("서버 오류");
  });
});
