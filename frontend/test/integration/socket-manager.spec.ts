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
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "FOCUSING",
        lastFocusStartTime: null,
      },
    ]);

    const remote = remotePlayerInstances.get("remote-1");
    expect(remote?.setFocusState).toHaveBeenCalledWith(true);
  });

  it("focused 이벤트를 수신하면 해당 플레이어가 집중 상태로 변경된다", () => {
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "RESTING",
        lastFocusStartTime: null,
      },
    ]);

    const remote = remotePlayerInstances.get("remote-1");
    currentSocket.trigger("focused", {
      userId: "remote-1",
      username: "alice",
      status: "FOCUSING",
    });

    expect(remote?.setFocusState).toHaveBeenCalledWith(true);
  });

  it("rested 이벤트를 수신하면 해당 플레이어가 휴식 상태로 변경된다", () => {
    currentSocket.trigger("players_synced", [
      {
        userId: "remote-1",
        username: "alice",
        x: 0,
        y: 0,
        playerId: 1,
        status: "FOCUSING",
        lastFocusStartTime: null,
      },
    ]);

    const remote = remotePlayerInstances.get("remote-1");
    currentSocket.trigger("rested", {
      userId: "remote-1",
      username: "alice",
      status: "RESTING",
    });

    expect(remote?.setFocusState).toHaveBeenCalledWith(false);
  });
});
