import { Socket } from 'socket.io';
import { RoomService } from '../room/room.service';
export declare class ChatGateway {
    private readonly roomService;
    constructor(roomService: RoomService);
    handleMessage(data: {
        message: string;
    }, client: Socket): void;
}
