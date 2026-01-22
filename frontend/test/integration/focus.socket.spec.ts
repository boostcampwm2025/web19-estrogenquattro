import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { createTestSocketServer } from "../mocks/socket-server";

type JoinedClient = {
  socket: Socket;
  close: () => void;
};

const waitForEvent = <T>(socket: Socket, event: string): Promise<T> =>
  new Promise((resolve) => {
    socket.once(event, (data: T) => resolve(data));
  });

const createJoinedClient = async (
  url: string,
  username: string,
): Promise<JoinedClient> => {
  const socket = io(url, { transports: ["websocket"] });
  await waitForEvent(socket, "connect");
  socket.emit("joining", { x: 0, y: 0, username });
  await waitForEvent(socket, "joined");

  return {
    socket,
    close: () => socket.disconnect(),
  };
};

describe("FocusTime Socket 통합", () => {
  let serverUrl = "";
  let closeServer: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestSocketServer();
    serverUrl = server.url;
    closeServer = server.close;
  });

  afterAll(async () => {
    if (closeServer) {
      await closeServer();
    }
  });

  it("startFocusing을 호출하면 focused 이벤트가 전파된다", async () => {
    const { socket: observer, close: closeObserver } = await createJoinedClient(
      serverUrl,
      "observer",
    );

    process.env.NEXT_PUBLIC_SOCKET_URL = serverUrl;
    vi.resetModules();

    const { connectSocket, disconnectSocket } = await import("@/lib/socket");
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    const actorSocket = connectSocket();
    await waitForEvent(actorSocket, "connect");
    actorSocket.emit("joining", { x: 0, y: 0, username: "actor" });
    await waitForEvent(actorSocket, "joined");

    const focusedPromise = waitForEvent<{ status: string }>(
      observer,
      "focused",
    );

    useFocusTimeStore.getState().startFocusing();

    const focused = await focusedPromise;
    expect(focused.status).toBe("FOCUSING");

    disconnectSocket();
    closeObserver();
  });

  it("stopFocusing을 호출하면 rested 이벤트가 전파된다", async () => {
    const { socket: observer, close: closeObserver } = await createJoinedClient(
      serverUrl,
      "observer",
    );

    process.env.NEXT_PUBLIC_SOCKET_URL = serverUrl;
    vi.resetModules();

    const { connectSocket, disconnectSocket } = await import("@/lib/socket");
    const { useFocusTimeStore } = await import("@/stores/useFocusTimeStore");

    const actorSocket = connectSocket();
    await waitForEvent(actorSocket, "connect");
    actorSocket.emit("joining", { x: 0, y: 0, username: "actor" });
    await waitForEvent(actorSocket, "joined");

    // 먼저 FOCUSING 상태로 전환 (stopFocusing은 FOCUSING 상태에서만 동작)
    const focusedPromise = waitForEvent<{ status: string }>(
      observer,
      "focused",
    );
    useFocusTimeStore.getState().startFocusing();
    await focusedPromise;

    const restedPromise = waitForEvent<{ status: string }>(observer, "rested");

    useFocusTimeStore.getState().stopFocusing();

    const rested = await restedPromise;
    expect(rested.status).toBe("RESTING");

    disconnectSocket();
    closeObserver();
  });
});
