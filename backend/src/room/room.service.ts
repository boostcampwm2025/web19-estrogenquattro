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

    // Linear search for the first available room
    let targetRoomId = 'room-1'; // Default fallback
    for (let i = 1; i <= this.totalRooms; i++) {
      const roomId = `room-${i}`;
      const room = this.roomInfos.get(roomId);
      if (room && room.size < room.capacity) {
        targetRoomId = roomId;
        break;
      }
    }

    const room = this.roomInfos.get(targetRoomId)!;
    room.size += 1;
    this.socketIdToRoomId.set(socketId, targetRoomId);
    
    return targetRoomId;
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
}
