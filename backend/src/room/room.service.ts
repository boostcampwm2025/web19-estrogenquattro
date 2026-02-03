import { Injectable, Logger } from '@nestjs/common';

type RoomInfo = {
  id: string;
  capacity: number;
  size: number;
};

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  private readonly capacity = 14;
  private readonly totalRooms = 5;

  private roomInfos = new Map<string, RoomInfo>();
  private socketIdToRoomId = new Map<string, string>();
  private roomIdToPlayerIds = new Map<string, Set<number>>();

  constructor() {
    this.initializeRooms();
  }

  private initializeRooms() {
    for (let i = 1; i <= this.totalRooms; i++) {
      const id = `room-${i}`;
      this.roomInfos.set(id, { id, capacity: this.capacity, size: 0 });
      this.roomIdToPlayerIds.set(id, new Set());
    }
  }

  randomJoin(socketId: string): string {
    const existing = this.socketIdToRoomId.get(socketId);
    if (existing) return existing;

    // 1. Pick a random starting point
    const startIndex = Math.floor(Math.random() * this.totalRooms) + 1; // 1 to 5
    
    // 2. Linear search ensuring we check all rooms starting from the random index
    let targetRoomId: string | null = null;

    for (let i = 0; i < this.totalRooms; i++) {
        // Calculate room index with wrap-around logic
        // (startIndex - 1 + i) % totalRooms gives 0-4 index based on offset i
        // + 1 converts it back to 1-5 range
        const roomNum = ((startIndex - 1 + i) % this.totalRooms) + 1;
        const roomId = `room-${roomNum}`;
        const room = this.roomInfos.get(roomId);

        if (room && room.size < room.capacity) {
            targetRoomId = roomId;
            break;
        }
    }

    if (!targetRoomId) {
        throw new Error('All rooms are full');
    }

    const room = this.roomInfos.get(targetRoomId)!;
    room.size += 1;
    this.socketIdToRoomId.set(socketId, targetRoomId);
    
    return targetRoomId;
  }

  joinRoom(socketId: string, roomId: string): string {
    const existing = this.socketIdToRoomId.get(socketId);
    if (existing) return existing;

    const room = this.roomInfos.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.size >= room.capacity) {
      throw new Error('Room is full');
    }

    room.size += 1;
    this.socketIdToRoomId.set(socketId, roomId);

    return roomId;
  }

  exit(socketId: string): string | undefined {
    const roomId = this.socketIdToRoomId.get(socketId);
    if (!roomId) return undefined;

    const room = this.roomInfos.get(roomId);
    if (room) {
      room.size = Math.max(0, room.size - 1);
    }

    this.socketIdToRoomId.delete(socketId);
    return roomId;
  }

  getRoomIdBySocketId(socketId: string): string | undefined {
    return this.socketIdToRoomId.get(socketId);
  }

  addPlayer(roomId: string, playerId: number) {
    const players = this.roomIdToPlayerIds.get(roomId);
    if (players) {
      players.add(playerId);
    }
  }

  removePlayer(roomId: string, playerId: number) {
    const players = this.roomIdToPlayerIds.get(roomId);
    if (players) {
      players.delete(playerId);
    }
  }

  getPlayerIds(roomId: string): number[] {
    const players = this.roomIdToPlayerIds.get(roomId);
    return players ? Array.from(players) : [];
  }

  getAllRoomPlayers(): Record<string, number[]> {
    const result: Record<string, number[]> = {};
    for (const [roomId, players] of this.roomIdToPlayerIds) {
      result[roomId] = Array.from(players);
    }
    return result;
  }
}
