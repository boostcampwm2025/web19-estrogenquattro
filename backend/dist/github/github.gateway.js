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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const PROGRESS_PER_COMMIT = 2;
const PROGRESS_PER_PR = 5;
let GithubGateway = class GithubGateway {
    server;
    roomStates = new Map();
    castGithubEventToRoom(githubEvent, roomId) {
        this.updateRoomState(roomId, githubEvent);
        this.server.to(roomId).emit('github_event', githubEvent);
    }
    updateRoomState(roomId, event) {
        let state = this.roomStates.get(roomId);
        if (!state) {
            state = { progress: 0, contributions: {} };
            this.roomStates.set(roomId, state);
        }
        const progressIncrement = event.pushCount * PROGRESS_PER_COMMIT +
            event.pullRequestCount * PROGRESS_PER_PR;
        state.progress = (state.progress + progressIncrement) % 100;
        const totalCount = event.pushCount + event.pullRequestCount;
        state.contributions[event.username] =
            (state.contributions[event.username] || 0) + totalCount;
    }
    getRoomState(roomId) {
        return this.roomStates.get(roomId) || { progress: 0, contributions: {} };
    }
};
exports.GithubGateway = GithubGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GithubGateway.prototype, "server", void 0);
exports.GithubGateway = GithubGateway = __decorate([
    (0, websockets_1.WebSocketGateway)()
], GithubGateway);
//# sourceMappingURL=github.gateway.js.map