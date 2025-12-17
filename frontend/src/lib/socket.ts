import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true, // httpOnly 쿠키 전송
      autoConnect: false, // 수동 연결
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const sock = getSocket();
  if (!sock.connected) {
    sock.connect();
  }
  return sock;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
