import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { MoveReq } from './dto/move.dto';
import { PlayTimeService } from './player.play-time-service';
import { GithubPollService } from '../github/github.poll-service';
import { GithubGateway } from '../github/github.gateway';
import { RoomService } from '../room/room.service';
export declare class PlayerGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly playTimeService;
    private readonly githubService;
    private readonly githubGateway;
    private readonly wsJwtGuard;
    private readonly roomService;
    private readonly logger;
    constructor(playTimeService: PlayTimeService, githubService: GithubPollService, githubGateway: GithubGateway, wsJwtGuard: WsJwtGuard, roomService: RoomService);
    server: Server;
    private players;
    private userSockets;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoin(data: {
        x: number;
        y: number;
        username: string;
    }, client: Socket): void;
    handleMove(data: MoveReq, client: Socket): void;
    private createTimerCallback;
}
