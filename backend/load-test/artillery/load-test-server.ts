/**
 * Artillery 부하 테스트용 전용 Socket.IO 서버 v2
 *
 * - 5개 room 사전 초기화 (room-1 ~ room-5, 각 14명 제한)
 * - 프로덕션 PlayerGateway의 이동 처리 로직 복제 (인증 없음)
 *
 * 실행: npx ts-node benchmark/load-test-server.ts
 */

import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 4999;
const TOTAL_ROOMS = 5;
const ROOM_CAPACITY = 14;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

// 프로덕션과 동일한 인메모리 플레이어 상태 Map
const players: Map<
  string,
  {
    socketId: string;
    username: string;
    roomId: string;
    x: number;
    y: number;
  }
> = new Map();

// Room별 접속자 수 추적
const roomSizes: Map<string, number> = new Map();
for (let i = 1; i <= TOTAL_ROOMS; i++) {
  roomSizes.set(`room-${i}`, 0);
}

let totalEventsProcessed = 0;

// 10초마다 상태 출력
setInterval(() => {
  const roomStatus = Array.from(roomSizes.entries())
    .map(([id, size]) => `${id}:${size}`)
    .join(' | ');
  console.log(
    `[Status] total connections: ${players.size} | events: ${totalEventsProcessed} | ${roomStatus}`,
  );
}, 10_000);

io.on('connection', (socket) => {
  socket.on(
    'joining',
    (data: { x: number; y: number; username: string; roomId?: string }) => {
      const roomId = data.roomId || 'room-1';

      // Room capacity 체크
      const currentSize = roomSizes.get(roomId) || 0;
      if (currentSize >= ROOM_CAPACITY) {
        socket.emit('join_failed', {
          message: `Room ${roomId} is full`,
          code: 'ROOM_FULL',
        });
        return;
      }

      roomSizes.set(roomId, currentSize + 1);

      players.set(socket.id, {
        socketId: socket.id,
        username: data.username || `user-${socket.id}`,
        roomId,
        x: data.x,
        y: data.y,
      });

      void socket.join(roomId);

      // 같은 room의 기존 플레이어 전송
      const existingPlayers = Array.from(players.values()).filter(
        (p) => p.socketId !== socket.id && p.roomId === roomId,
      );
      socket.emit('players_synced', existingPlayers);

      socket.to(roomId).emit('player_joined', {
        userId: socket.id,
        username: data.username,
        x: data.x,
        y: data.y,
      });

      socket.emit('joined', { roomId });
    },
  );

  // JSON 이동 이벤트
  socket.on(
    'moving_json',
    (data: {
      x: number;
      y: number;
      isMoving: boolean;
      direction: string;
      timestamp: number;
    }) => {
      totalEventsProcessed++;

      const player = players.get(socket.id);
      if (!player) return;
      player.x = data.x;
      player.y = data.y;

      socket.to(player.roomId).emit('moved_json', {
        userId: socket.id,
        x: data.x,
        y: data.y,
        isMoving: data.isMoving,
        direction: data.direction,
        timestamp: data.timestamp,
      });
    },
  );

  // 바이너리 이동 이벤트
  socket.on('moving_binary', (data: Buffer | ArrayBuffer) => {
    totalEventsProcessed++;

    const player = players.get(socket.id);
    if (!player) return;

    try {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (buf.length >= 8) {
        player.x = buf.readFloatLE(0);
        player.y = buf.readFloatLE(4);
      }
    } catch {
      // ignore
    }

    socket.to(player.roomId).emit('moved_binary', data);
  });

  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      socket.to(player.roomId).emit('player_left', { userId: socket.id });

      const size = roomSizes.get(player.roomId) || 0;
      roomSizes.set(player.roomId, Math.max(0, size - 1));

      players.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Load test server v2 running on port ${PORT}`);
  console.log(
    `   Rooms: ${TOTAL_ROOMS} × ${ROOM_CAPACITY} capacity = ${TOTAL_ROOMS * ROOM_CAPACITY} max users`,
  );
  console.log('   Waiting for Artillery connections...\n');
});
