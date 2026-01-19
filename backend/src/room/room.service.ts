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
  private nextRoomNumber = 3;

  private rooms = new Map<string, RoomInfo>();
  private socketToRoom = new Map<string, string>();

  private availableRooms: string[] = [];
  private availableIndex = new Map<string, number>();

  constructor() {
    this.bootstrapInitialRooms();
  }

  private bootstrapInitialRooms() {
    for (let i = 1; i <= 3; i++) {
      const id = `room-${i}`;
      this.rooms.set(id, { id, capacity: this.capacity, size: 0 });
      this.addAvailableRoom(id);
    }
  }

  private addAvailableRoom(roomId: string) {
    if (this.availableIndex.has(roomId)) return;
    this.availableIndex.set(roomId, this.availableRooms.length);
    this.availableRooms.push(roomId);
  }

  private removeAvailableRoom(roomId: string) {
    const targetIdx = this.availableIndex.get(roomId);
    if (targetIdx === undefined) return;
    const lastRoomIdx = this.availableRooms.length - 1;
    const lastRoomId = this.availableRooms[lastRoomIdx];

    this.availableRooms[targetIdx] = lastRoomId;
    this.availableIndex.set(lastRoomId, targetIdx);

    this.availableRooms.pop();
    this.availableIndex.delete(roomId);
  }

  private createRoom(): string {
    const id = `room-${++this.nextRoomNumber}`;
    this.rooms.set(id, { id, capacity: this.capacity, size: 0 });
    this.addAvailableRoom(id);
    this.logger.log(`Created new room: ${id}`);
    return id;
  }

  private pickAvailableRoom(): string {
    if (this.availableRooms.length === 0) {
      return this.createRoom();
    }
    const idx = Math.floor(Math.random() * this.availableRooms.length);
    return this.availableRooms[idx];
  }

  randomJoin(socketId: string): string {
    const existing = this.socketToRoom.get(socketId);
    if (existing) return existing;

    const roomId = this.pickAvailableRoom();
    const room = this.rooms.get(roomId)!;
    room.size += 1;
    if (room.size >= room.capacity) {
      this.removeAvailableRoom(roomId);
    }
    this.socketToRoom.set(socketId, roomId);
    return roomId;
  }

  exit(socketId: string): string | undefined {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return undefined;
    const room = this.rooms.get(roomId);
    if (room) {
      room.size = Math.max(0, room.size - 1);
      if (room.size < room.capacity) {
        this.addAvailableRoom(roomId);
      }
    }
    this.socketToRoom.delete(socketId);
    return roomId;
  }

  getRoomIdBySocketId(socketId: string): string | undefined {
    return this.socketToRoom.get(socketId);
  }

  private roomPlayers = new Map<string, Set<number>>();

  addPlayer(roomId: string, playerId: number) {
    if (!this.roomPlayers.has(roomId)) {
      this.roomPlayers.set(roomId, new Set());
    }
    const players = this.roomPlayers.get(roomId);
    if (players) {
      players.add(playerId);
    }
  }

  removePlayer(roomId: string, playerId: number) {
    const players = this.roomPlayers.get(roomId);
    if (players) {
      players.delete(playerId);
      if (players.size === 0) {
        this.roomPlayers.delete(roomId);
      }
    }
  }

  getPlayerIds(roomId: string): number[] {
    const players = this.roomPlayers.get(roomId);
    return players ? Array.from(players) : [];
  }
}
