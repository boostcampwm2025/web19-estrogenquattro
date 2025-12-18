import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(API_URL, {
      transports: ["websocket"],
      withCredentials: true,
      autoConnect: false,
    });
  }
  return socket;
};

export const connectSocket = (): Socket => {
  const sock = getSocket();
  if (!sock.connected) {
    sock.connect();
  }
  return sock;
};

export const disconnectSocket = (): void => {
  if (socket?.connected) {
    socket.disconnect();
  }
};

export const emitEvent = (event: string, data: unknown) => {
  const sock = getSocket();
  if (sock.connected) {
    sock.emit(event, data);
  }
};
