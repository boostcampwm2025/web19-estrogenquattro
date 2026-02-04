import { Injectable, Logger } from '@nestjs/common';
import {
  RoomFullException,
  RoomNotFoundException,
} from './exceptions/room.exception';

export type RoomInfo = {
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

  private reservations = new Map<number, NodeJS.Timeout>(); // playerId -> timeout
  private reservedRooms = new Map<number, string>(); // playerId -> roomId

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

  reserveRoom(playerId: number, roomId: string) {
    this.cancelReservation(playerId);

    const room = this.roomInfos.get(roomId);
    if (!room) throw new RoomNotFoundException();

    if (room.size >= room.capacity) {
      throw new RoomFullException();
    }

    room.size += 1;
    this.reservedRooms.set(playerId, roomId);

    const timeout = setTimeout(() => {
      this.cancelReservation(playerId);
    }, 30000);
    this.reservations.set(playerId, timeout);
  }

  private disposeReservation(playerId: number): string | undefined {
    const timeout = this.reservations.get(playerId);
    if (timeout) {
      clearTimeout(timeout);
      this.reservations.delete(playerId);
    }
    const reservedRoomId = this.reservedRooms.get(playerId);
    if (reservedRoomId) {
      this.reservedRooms.delete(playerId);
      return reservedRoomId;
    }
    return undefined;
  }

  private cancelReservation(playerId: number) {
    const reservedRoomId = this.disposeReservation(playerId);
    if (reservedRoomId) {
      this.decreaseRoomSize(reservedRoomId);
    }
  }

  private decreaseRoomSize(roomId: string) {
    const room = this.roomInfos.get(roomId);
    if (room) {
      room.size = Math.max(0, room.size - 1);
    }
  }

  private consumeReservation(playerId: number | undefined): string | null {
    if (!playerId) return null;
    return this.disposeReservation(playerId) ?? null;
  }

  randomJoin(socketId: string, playerId?: number): string {
    const existing = this.socketIdToRoomId.get(socketId);
    if (existing) return existing;

    if (playerId) {
      this.cancelReservation(playerId);
    }

    const startIndex = Math.floor(Math.random() * this.totalRooms) + 1;

    let targetRoomId: string | null = null;

    for (let i = 0; i < this.totalRooms; i++) {
      const roomNum = ((startIndex - 1 + i) % this.totalRooms) + 1;
      const roomId = `room-${roomNum}`;
      const room = this.roomInfos.get(roomId);

      if (room && room.size < room.capacity) {
        targetRoomId = roomId;
        break;
      }
    }

    if (!targetRoomId) {
      throw new RoomFullException();
    }

    const room = this.roomInfos.get(targetRoomId)!;
    room.size += 1;
    this.socketIdToRoomId.set(socketId, targetRoomId);

    return targetRoomId;
  }

  joinRoom(socketId: string, roomId: string, playerId: number): string {
    const existing = this.socketIdToRoomId.get(socketId);
    if (existing) return existing;

    const reservedRoomId = this.consumeReservation(playerId);
    if (reservedRoomId) {
      if (reservedRoomId === roomId) {
        this.socketIdToRoomId.set(socketId, roomId);
        return roomId;
      }
      this.decreaseRoomSize(reservedRoomId);
    }

    const room = this.roomInfos.get(roomId);
    if (!room) {
      throw new RoomNotFoundException();
    }

    if (room.size >= room.capacity) {
      throw new RoomFullException();
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

  getAllRooms(): Record<string, RoomInfo> {
    return Object.fromEntries(this.roomInfos);
  }
}
