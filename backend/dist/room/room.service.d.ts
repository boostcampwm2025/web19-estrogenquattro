export declare class RoomService {
    private readonly logger;
    private readonly capacity;
    private nextRoomNumber;
    private rooms;
    private socketToRoom;
    private availableRooms;
    private availableIndex;
    constructor();
    private bootstrapInitialRooms;
    private addAvailableRoom;
    private removeAvailableRoom;
    private createRoom;
    private pickAvailableRoom;
    randomJoin(socketId: string): string;
    exit(socketId: string): string | undefined;
    getRoomIdBySocketId(socketId: string): string | undefined;
}
