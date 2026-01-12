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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PlayerGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const ws_jwt_guard_1 = require("../auth/ws-jwt.guard");
const move_dto_1 = require("./dto/move.dto");
const player_play_time_service_1 = require("./player.play-time-service");
const github_poll_service_1 = require("../github/github.poll-service");
const github_gateway_1 = require("../github/github.gateway");
const room_service_1 = require("../room/room.service");
let PlayerGateway = PlayerGateway_1 = class PlayerGateway {
    playTimeService;
    githubService;
    githubGateway;
    wsJwtGuard;
    roomService;
    logger = new common_1.Logger(PlayerGateway_1.name);
    constructor(playTimeService, githubService, githubGateway, wsJwtGuard, roomService) {
        this.playTimeService = playTimeService;
        this.githubService = githubService;
        this.githubGateway = githubGateway;
        this.wsJwtGuard = wsJwtGuard;
        this.roomService = roomService;
    }
    server;
    players = new Map();
    userSockets = new Map();
    handleConnection(client) {
        const isValid = this.wsJwtGuard.verifyClient(client);
        if (!isValid) {
            this.logger.warn(`Connection rejected (unauthorized): ${client.id}`);
            client.disconnect();
            return;
        }
        const data = client.data;
        const user = data.user;
        this.logger.log(`Client connected: ${client.id} (user: ${user.username})`);
    }
    handleDisconnect(client) {
        const player = this.players.get(client.id);
        if (player) {
            this.players.delete(client.id);
            this.server.to(player.roomId).emit('player_left', { userId: client.id });
            this.playTimeService.stopTimer(client.id);
            this.githubService.unsubscribeGithubEvent(client.id);
            this.roomService.exit(client.id);
            if (this.userSockets.get(player.username) === client.id) {
                this.userSockets.delete(player.username);
            }
        }
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    handleJoin(data, client) {
        const roomId = this.roomService.randomJoin(client.id);
        const userData = client.data;
        const { username, accessToken } = userData.user;
        const existingSocketId = this.userSockets.get(username);
        if (existingSocketId && existingSocketId !== client.id) {
            const existingSocket = this.server.sockets.sockets.get(existingSocketId);
            if (existingSocket) {
                this.logger.log(`Disconnecting previous session for ${username}: ${existingSocketId}`);
                existingSocket.emit('session_replaced', {
                    message: '다른 탭에서 접속하여 현재 세션이 종료됩니다.',
                });
                existingSocket.disconnect(true);
            }
        }
        this.userSockets.set(username, client.id);
        void client.join(roomId);
        this.players.set(client.id, {
            socketId: client.id,
            userId: client.id,
            username: username,
            roomId: roomId,
            x: data.x,
            y: data.y,
        });
        const existingPlayers = Array.from(this.players.values()).filter((p) => p.socketId !== client.id && p.roomId === roomId);
        client.emit('players_synced', existingPlayers);
        client.to(roomId).emit('player_joined', {
            userId: client.id,
            username: username,
            x: data.x,
            y: data.y,
        });
        const connectedAt = new Date();
        this.playTimeService.startTimer(client.id, username, this.createTimerCallback(client), connectedAt);
        this.githubService.subscribeGithubEvent(connectedAt, client.id, roomId, username, accessToken);
        const roomState = this.githubGateway.getRoomState(roomId);
        client.emit('github_state', roomState);
        const roomPlayers = Array.from(this.players.values()).filter((p) => p.roomId === roomId);
        for (const player of roomPlayers) {
            const minutes = this.playTimeService.getUserMinutes(player.username);
            if (minutes > 0) {
                client.emit('timerUpdated', {
                    userId: player.socketId,
                    minutes,
                });
            }
        }
    }
    handleMove(data, client) {
        const player = this.players.get(client.id);
        if (player) {
            player.x = data.x;
            player.y = data.y;
        }
        if (!player)
            return;
        client.to(player.roomId).emit('moved', {
            userId: client.id,
            x: data.x,
            y: data.y,
            isMoving: data.isMoving,
            direction: data.direction,
            timestamp: data.timestamp,
        });
    }
    createTimerCallback(client) {
        return (minutes) => {
            const player = this.players.get(client.id);
            this.server.to(player.roomId).emit('timerUpdated', {
                userId: client.id,
                minutes,
            });
        };
    }
};
exports.PlayerGateway = PlayerGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], PlayerGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joining'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], PlayerGateway.prototype, "handleJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('moving'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [move_dto_1.MoveReq,
        socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], PlayerGateway.prototype, "handleMove", null);
exports.PlayerGateway = PlayerGateway = PlayerGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)(),
    __metadata("design:paramtypes", [player_play_time_service_1.PlayTimeService,
        github_poll_service_1.GithubPollService,
        github_gateway_1.GithubGateway,
        ws_jwt_guard_1.WsJwtGuard,
        room_service_1.RoomService])
], PlayerGateway);
//# sourceMappingURL=player.gateway.js.map