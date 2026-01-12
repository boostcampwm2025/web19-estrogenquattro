"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RoomService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomService = void 0;
const common_1 = require("@nestjs/common");
let RoomService = RoomService_1 = class RoomService {
    logger = new common_1.Logger(RoomService_1.name);
    capacity = 14;
    nextRoomNumber = 3;
    rooms = new Map();
    socketToRoom = new Map();
    availableRooms = [];
    availableIndex = new Map();
    constructor() {
        this.bootstrapInitialRooms();
    }
    bootstrapInitialRooms() {
        for (let i = 1; i <= 3; i++) {
            const id = `room-${i}`;
            this.rooms.set(id, { id, capacity: this.capacity, size: 0 });
            this.addAvailableRoom(id);
        }
    }
    addAvailableRoom(roomId) {
        if (this.availableIndex.has(roomId))
            return;
        this.availableIndex.set(roomId, this.availableRooms.length);
        this.availableRooms.push(roomId);
    }
    removeAvailableRoom(roomId) {
        const targetIdx = this.availableIndex.get(roomId);
        if (targetIdx === undefined)
            return;
        const lastRoomIdx = this.availableRooms.length - 1;
        const lastRoomId = this.availableRooms[lastRoomIdx];
        this.availableRooms[targetIdx] = lastRoomId;
        this.availableIndex.set(lastRoomId, targetIdx);
        this.availableRooms.pop();
        this.availableIndex.delete(roomId);
    }
    createRoom() {
        const id = `room-${++this.nextRoomNumber}`;
        this.rooms.set(id, { id, capacity: this.capacity, size: 0 });
        this.addAvailableRoom(id);
        this.logger.log(`Created new room: ${id}`);
        return id;
    }
    pickAvailableRoom() {
        if (this.availableRooms.length === 0) {
            return this.createRoom();
        }
        const idx = Math.floor(Math.random() * this.availableRooms.length);
        return this.availableRooms[idx];
    }
    randomJoin(socketId) {
        const existing = this.socketToRoom.get(socketId);
        if (existing)
            return existing;
        const roomId = this.pickAvailableRoom();
        const room = this.rooms.get(roomId);
        room.size += 1;
        if (room.size >= room.capacity) {
            this.removeAvailableRoom(roomId);
        }
        this.socketToRoom.set(socketId, roomId);
        return roomId;
    }
    exit(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        if (!roomId)
            return undefined;
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
    getRoomIdBySocketId(socketId) {
        return this.socketToRoom.get(socketId);
    }
};
exports.RoomService = RoomService;
exports.RoomService = RoomService = RoomService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RoomService);
//# sourceMappingURL=room.service.js.map