import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (data?: unknown) => void;

type FakeSocket = {
  id: string;
  connected: boolean;
  on: (event: string, handler: Handler) => void;
  emit: (event: string, data?: unknown) => void;
  disconnect: () => void;
  trigger: (event: string, data?: unknown) => void;
};

type SocketManagerCtor = typeof import("@/game/managers/SocketManager").default;

const remotePlayerInstances = new Map<
  string,
  {
    setFocusState: ReturnType<typeof vi.fn>;
    updateTaskBubble: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }
>();

vi.mock("phaser", () => ({}));

vi.mock("@/game/players/RemotePlayer", () => ({
  default: vi.fn().mockImplementation((_scene, _x, _y, _username, id) => {
    const instance = {
      setFocusState: vi.fn(),
      updateTaskBubble: vi.fn(),
      destroy: vi.fn(),
      updateState: vi.fn(),
      showChatBubble: vi.fn(),
      getContainer: vi.fn(() => ({})),
      updateFaceTexture: vi.fn(),
    };
    remotePlayerInstances.set(id as string, instance);
    return instance;
  }),
}));

let currentSocket: FakeSocket;

vi.mock("@/lib/socket", () => ({
  connectSocket: () => currentSocket,
  getSocket: () => currentSocket,
}));

const createFakeSocket = (): FakeSocket => {
  const handlers = new Map<string, Handler[]>();

  return {
    id: "socket-local",
    connected: true,
    on: (event, handler) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    emit: vi.fn(),
    disconnect: vi.fn(),
    trigger: (event, data) => {
      handlers.get(event)?.forEach((handler) => handler(data));
    },
  };
};

describe("SocketManager 통합", () => {
  let SocketManager: SocketManagerCtor;
  let socketManager: InstanceType<SocketManagerCtor>;

  const scene = {
    physics: { add: { collider: vi.fn() } },
    textures: { exists: vi.fn(() => true) },
    load: { image: vi.fn(), once: vi.fn(), start: vi.fn() },
  };

  const player = {
    id: "local-player",
    getContainer: () => ({ x: 0, y: 0 }),
    setRoomId: vi.fn(),
    showChatBubble: vi.fn(),
  };

  const callbacks = {
    showSessionEndedOverlay: vi.fn(),
    showConnectionLostOverlay: vi.fn(),
    hideConnectionLostOverlay: vi.fn(),
  };

  beforeEach(async () => {
    remotePlayerInstances.clear();
    currentSocket = createFakeSocket();
    vi.resetModules();
    callbacks.showSessionEndedOverlay.mockClear();
    callbacks.showConnectionLostOverlay.mockClear();
    callbacks.hideConnectionLostOverlay.mockClear();
    SocketManager = (await import("@/game/managers/SocketManager")).default;
    socketManager = new SocketManager(scene as never, "tester", () => player);
    socketManager.connect(callbacks);
  });

  it("players_synced로 FOCUSING 상태를 수신하면 해당 플레이어에 집중 상태가 반영된다", () => {
    // Given: 없음 (초기 상태)

    // When: players_synced 이벤트로 FOCUSING 상태의 플레이어 수신
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "FOCUSING",
        currentSessionSeconds: 0,
        taskName: "코딩하기",
      },
    ]);

    // Then: setFocusState(true)가 옵션 객체와 함께 호출됨
    const remote = remotePlayerInstances.get("remote-1");
    expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
      currentSessionSeconds: 0,
      totalFocusSeconds: 0,
      taskName: "코딩하기",
    });
  });

  it("players_synced로 RESTING 상태를 수신하면 setFocusState(false)가 호출된다", () => {
    // Given: 없음 (초기 상태)

    // When: players_synced 이벤트로 RESTING 상태의 플레이어 수신
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "RESTING",
        currentSessionSeconds: 0,
        totalFocusSeconds: 30,
        taskName: null,
      },
    ]);

    // Then: setFocusState(false)가 totalFocusSeconds와 함께 호출됨
    const remote = remotePlayerInstances.get("remote-1");
    expect(remote?.setFocusState).toHaveBeenCalledWith(false, {
      currentSessionSeconds: 0,
      totalFocusSeconds: 30,
      taskName: undefined,
    });
  });

  it("focused 이벤트를 수신하면 해당 플레이어가 집중 상태로 변경된다", () => {
    // Given: RESTING 상태의 원격 플레이어가 존재
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "RESTING",
        currentSessionSeconds: 0,
      },
    ]);
    const remote = remotePlayerInstances.get("remote-1");

    // When: focused 이벤트 수신
    currentSocket.trigger("focused", {
      userId: "remote-1",
      username: "alice",
      status: "FOCUSING",
      currentSessionSeconds: 0,
    });

    // Then: setFocusState(true)가 호출됨
    expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
      taskName: undefined,
      currentSessionSeconds: 0,
      totalFocusSeconds: 0,
    });
  });

  it("rested 이벤트를 수신하면 해당 플레이어가 휴식 상태로 변경된다", () => {
    // Given: FOCUSING 상태의 원격 플레이어가 존재
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "FOCUSING",
        currentSessionSeconds: 0,
      },
    ]);
    const remote = remotePlayerInstances.get("remote-1");

    // When: rested 이벤트 수신
    currentSocket.trigger("rested", {
      userId: "remote-1",
      username: "alice",
      status: "RESTING",
    });

    // Then: setFocusState(false)가 호출됨
    expect(remote?.setFocusState).toHaveBeenCalledWith(false, {
      totalFocusSeconds: 0,
    });
  });

  it("focused 이벤트 수신 시 taskName이 setFocusState에 전달된다", () => {
    // Given: RESTING 상태의 원격 플레이어가 존재
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "RESTING",
        currentSessionSeconds: 0,
      },
    ]);
    const remote = remotePlayerInstances.get("remote-1");

    // When: taskName이 포함된 focused 이벤트 수신
    currentSocket.trigger("focused", {
      userId: "remote-1",
      username: "alice",
      status: "FOCUSING",
      taskName: "코딩하기",
      currentSessionSeconds: 0,
    });

    // Then: setFocusState가 taskName과 함께 호출됨
    expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
      taskName: "코딩하기",
      currentSessionSeconds: 0,
      totalFocusSeconds: 0,
    });
  });

  it("focused 이벤트 수신 시 totalFocusSeconds와 currentSessionSeconds가 전달된다", () => {
    // Given: RESTING 상태의 원격 플레이어가 존재
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "RESTING",
        currentSessionSeconds: 0,
      },
    ]);
    const remote = remotePlayerInstances.get("remote-1");

    // When: 집중시간 데이터가 포함된 focused 이벤트 수신
    currentSocket.trigger("focused", {
      userId: "remote-1",
      username: "alice",
      status: "FOCUSING",
      taskName: "집중 작업",
      currentSessionSeconds: 120,
      totalFocusSeconds: 60,
    });

    // Then: setFocusState가 집중시간 데이터와 함께 호출됨
    expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
      taskName: "집중 작업",
      currentSessionSeconds: 120,
      totalFocusSeconds: 60,
    });
  });

  it("rested 이벤트 수신 시 totalFocusSeconds가 전달된다", () => {
    // Given: FOCUSING 상태의 원격 플레이어가 존재
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "FOCUSING",
        currentSessionSeconds: 0,
      },
    ]);
    const remote = remotePlayerInstances.get("remote-1");

    // When: totalFocusSeconds가 포함된 rested 이벤트 수신
    currentSocket.trigger("rested", {
      userId: "remote-1",
      username: "alice",
      status: "RESTING",
      totalFocusSeconds: 90,
    });

    // Then: setFocusState가 totalFocusSeconds와 함께 호출됨
    expect(remote?.setFocusState).toHaveBeenCalledWith(false, {
      totalFocusSeconds: 90,
    });
  });

  it("players_synced에서 totalFocusSeconds와 currentSessionSeconds가 전달된다", () => {
    // Given: 없음 (초기 상태)

    // When: 집중시간 데이터가 포함된 players_synced 이벤트 수신
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "FOCUSING",
        currentSessionSeconds: 300,
        totalFocusSeconds: 120,
        taskName: "집중 작업",
      },
    ]);

    // Then: setFocusState가 집중시간 데이터와 함께 호출됨
    const remote = remotePlayerInstances.get("remote-1");
    expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
      currentSessionSeconds: 300,
      totalFocusSeconds: 120,
      taskName: "집중 작업",
    });
  });

  it("player_joined로 FOCUSING 상태를 수신하면 해당 플레이어에 집중 상태가 반영된다", () => {
    // Given: 없음 (초기 상태)

    // When: player_joined 이벤트로 FOCUSING 상태의 플레이어 수신
    currentSocket.trigger("player_joined", {
      userId: "remote-2",
      username: "bob",
      x: 100,
      y: 200,
      status: "FOCUSING",
      totalFocusSeconds: 10,
      currentSessionSeconds: 30,
      taskName: "리뷰하기",
    });

    // Then: setFocusState(true)가 옵션 객체와 함께 호출됨
    const remote = remotePlayerInstances.get("remote-2");
    expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
      currentSessionSeconds: 30,
      totalFocusSeconds: 10,
      taskName: "리뷰하기",
    });
  });

  it("player_joined로 RESTING 상태를 수신하면 setFocusState(false)가 호출된다", () => {
    // Given: 없음 (초기 상태)

    // When: player_joined 이벤트로 RESTING 상태의 플레이어 수신
    currentSocket.trigger("player_joined", {
      userId: "remote-2",
      username: "bob",
      x: 100,
      y: 200,
      status: "RESTING",
      totalFocusSeconds: 15,
      currentSessionSeconds: 0,
      taskName: null,
    });

    // Then: setFocusState(false)가 호출됨
    const remote = remotePlayerInstances.get("remote-2");
    expect(remote?.setFocusState).toHaveBeenCalledWith(false, {
      currentSessionSeconds: 0,
      totalFocusSeconds: 15,
      taskName: undefined,
    });
  });

  it("focus_task_updated 이벤트 수신 시 updateTaskBubble이 호출된다", () => {
    // Given: FOCUSING 상태의 원격 플레이어가 존재
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "FOCUSING",
        currentSessionSeconds: 0,
      },
    ]);
    const remote = remotePlayerInstances.get("remote-1");

    // When: focus_task_updated 이벤트 수신
    currentSocket.trigger("focus_task_updated", {
      userId: "remote-1",
      username: "alice",
      taskName: "리뷰하기",
    });

    // Then: updateTaskBubble이 올바른 인자로 호출됨
    expect(remote?.updateTaskBubble).toHaveBeenCalledWith({
      isFocusing: true,
      taskName: "리뷰하기",
    });
  });

  it("disconnect 이벤트 발생 시 showConnectionLostOverlay 콜백이 호출된다", () => {
    // Given: 연결된 상태

    // When: 네트워크 오류로 disconnect 이벤트 발생
    currentSocket.trigger("disconnect", "transport close");

    // Then: showConnectionLostOverlay가 호출됨
    expect(callbacks.showConnectionLostOverlay).toHaveBeenCalled();
  });

  it("클라이언트가 의도적으로 연결을 끊으면 showConnectionLostOverlay가 호출되지 않는다", () => {
    // Given: 연결된 상태

    // When: 클라이언트가 의도적으로 disconnect
    currentSocket.trigger("disconnect", "io client disconnect");

    // Then: showConnectionLostOverlay가 호출되지 않음
    expect(callbacks.showConnectionLostOverlay).not.toHaveBeenCalled();
  });

  it("session_replaced 후 disconnect 시 showConnectionLostOverlay가 호출되지 않는다", () => {
    // Given: session_replaced 이벤트가 먼저 발생
    currentSocket.trigger("session_replaced");

    // When: 이후 disconnect 이벤트 발생
    currentSocket.trigger("disconnect", "transport close");

    // Then: showConnectionLostOverlay가 호출되지 않음 (세션 교체 오버레이만 표시)
    expect(callbacks.showConnectionLostOverlay).not.toHaveBeenCalled();
    expect(callbacks.showSessionEndedOverlay).toHaveBeenCalled();
  });

  it("connect 이벤트 발생 시 hideConnectionLostOverlay 콜백이 호출된다", () => {
    // Given: 연결이 끊어진 상태 (disconnect 발생)
    currentSocket.trigger("disconnect", "transport close");
    callbacks.hideConnectionLostOverlay.mockClear();

    // When: 재연결 (connect 이벤트 발생)
    currentSocket.trigger("connect");

    // Then: hideConnectionLostOverlay가 호출됨
    expect(callbacks.hideConnectionLostOverlay).toHaveBeenCalled();
  });

  it("session_replaced 이벤트 발생 시 showSessionEndedOverlay 콜백이 호출된다", () => {
    // Given: 연결된 상태

    // When: session_replaced 이벤트 발생
    currentSocket.trigger("session_replaced");

    // Then: showSessionEndedOverlay가 호출되고 소켓이 disconnect됨
    expect(callbacks.showSessionEndedOverlay).toHaveBeenCalled();
    expect(currentSocket.disconnect).toHaveBeenCalled();
  });
});
