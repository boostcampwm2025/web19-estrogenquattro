import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const connectSocket = (url: string) => {
  if (socket) {
    if (socket.connected) return socket;
    socket = null;
  }

  socket = io(url, {
    transports: ["websocket"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    console.log("Connected to socket server:", socket?.id);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from socket server");
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const emitEvent = (event: string, data: unknown) => {
  if (socket && socket.connected) {
    socket.emit(event, data);
  }
};
