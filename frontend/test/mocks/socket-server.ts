import { createServer } from "http";
import { Server } from "socket.io";
import type { AddressInfo } from "net";

type TestSocketServer = {
  url: string;
  close: () => Promise<void>;
};

export const createTestSocketServer = async (): Promise<TestSocketServer> => {
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: "*", credentials: true },
  });

  const players = new Map<
    string,
    { roomId: string; username: string; x: number; y: number }
  >();

  io.on("connection", (socket) => {
    socket.on("joining", (data: { x: number; y: number; username: string }) => {
      const roomId = "test-room";
      socket.join(roomId);
      players.set(socket.id, {
        roomId,
        username: data.username,
        x: data.x,
        y: data.y,
      });

      socket.emit("joined", { roomId });

      socket.to(roomId).emit("player_joined", {
        userId: socket.id,
        username: data.username,
        x: data.x,
        y: data.y,
      });

      const existingPlayers = Array.from(players.entries())
        .filter(([id]) => id !== socket.id)
        .map(([id, player]) => ({
          userId: id,
          username: player.username,
          roomId: player.roomId,
          x: player.x,
          y: player.y,
          playerId: 1,
          status: "RESTING",
          lastFocusStartTime: null,
        }));

      socket.emit("players_synced", existingPlayers);
    });

    socket.on("focusing", () => {
      const player = players.get(socket.id);
      if (!player) return;
      socket.to(player.roomId).emit("focused", {
        userId: socket.id,
        username: player.username,
        status: "FOCUSING",
        lastFocusStartTime: new Date().toISOString(),
      });
    });

    socket.on("resting", () => {
      const player = players.get(socket.id);
      if (!player) return;
      socket.to(player.roomId).emit("rested", {
        userId: socket.id,
        username: player.username,
        status: "RESTING",
        totalFocusMinutes: 0,
      });
    });

    socket.on("disconnect", () => {
      const player = players.get(socket.id);
      players.delete(socket.id);
      if (player) {
        socket.to(player.roomId).emit("player_left", { userId: socket.id });
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(0, "127.0.0.1", () => resolve());
    httpServer.on("error", reject);
  });

  const address = httpServer.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    close: async () => {
      await io.close();
      if (!httpServer.listening) {
        return;
      }
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
};
