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
    destroy: ReturnType<typeof vi.fn>;
  }
>();

vi.mock("phaser", () => ({}));

vi.mock("@/game/players/RemotePlayer", () => ({
  default: vi.fn().mockImplementation((_scene, _x, _y, _username, id) => {
    const instance = {
      setFocusState: vi.fn(),
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

  beforeEach(async () => {
    remotePlayerInstances.clear();
    currentSocket = createFakeSocket();
    vi.resetModules();
    SocketManager = (await import("@/game/managers/SocketManager")).default;
    socketManager = new SocketManager(scene as never, "tester", () => player);
    socketManager.connect(() => {});
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
      },
    ]);

    // Then: setFocusState(true)가 옵션 객체와 함께 호출됨
    const remote = remotePlayerInstances.get("remote-1");
    expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
      currentSessionSeconds: 0,
      totalFocusMinutes: 0,
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
        totalFocusMinutes: 30,
      },
    ]);

    // Then: setFocusState(false)가 totalFocusMinutes와 함께 호출됨
    const remote = remotePlayerInstances.get("remote-1");
    expect(remote?.setFocusState).toHaveBeenCalledWith(false, {
      currentSessionSeconds: 0,
      totalFocusMinutes: 30,
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
      totalFocusMinutes: 0,
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
      totalFocusMinutes: 0,
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
      totalFocusMinutes: 0,
    });
  });

  it("focused 이벤트 수신 시 totalFocusMinutes와 currentSessionSeconds가 전달된다", () => {
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
      totalFocusMinutes: 60,
    });

    // Then: setFocusState가 집중시간 데이터와 함께 호출됨
    expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
      taskName: "집중 작업",
      currentSessionSeconds: 120,
      totalFocusMinutes: 60,
    });
  });

  it("rested 이벤트 수신 시 totalFocusMinutes가 전달된다", () => {
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

    // When: totalFocusMinutes가 포함된 rested 이벤트 수신
    currentSocket.trigger("rested", {
      userId: "remote-1",
      username: "alice",
      status: "RESTING",
      totalFocusMinutes: 90,
    });

    // Then: setFocusState가 totalFocusMinutes와 함께 호출됨
    expect(remote?.setFocusState).toHaveBeenCalledWith(false, {
      totalFocusMinutes: 90,
    });
  });

  it("players_synced에서 totalFocusMinutes와 currentSessionSeconds가 전달된다", () => {
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
        totalFocusMinutes: 120,
      },
    ]);

    // Then: setFocusState가 집중시간 데이터와 함께 호출됨
    const remote = remotePlayerInstances.get("remote-1");
    expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
      currentSessionSeconds: 300,
      totalFocusMinutes: 120,
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
      totalFocusMinutes: 10,
      currentSessionSeconds: 30,
    });

    // Then: setFocusState(true)가 옵션 객체와 함께 호출됨
    const remote = remotePlayerInstances.get("remote-2");
    expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
      currentSessionSeconds: 30,
      totalFocusMinutes: 10,
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
      totalFocusMinutes: 15,
      currentSessionSeconds: 0,
    });

    // Then: setFocusState(false)가 호출됨
    const remote = remotePlayerInstances.get("remote-2");
    expect(remote?.setFocusState).toHaveBeenCalledWith(false, {
      currentSessionSeconds: 0,
      totalFocusMinutes: 15,
    });
  });
});
