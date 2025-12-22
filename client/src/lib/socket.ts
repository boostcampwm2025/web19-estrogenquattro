import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // 현재 페이지와 같은 호스트 사용
    socket = io({
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
