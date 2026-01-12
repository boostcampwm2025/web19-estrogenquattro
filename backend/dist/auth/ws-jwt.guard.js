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
exports.WsJwtGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const websockets_1 = require("@nestjs/websockets");
const user_store_1 = require("./user.store");
let WsJwtGuard = class WsJwtGuard {
    jwtService;
    userStore;
    constructor(jwtService, userStore) {
        this.jwtService = jwtService;
        this.userStore = userStore;
    }
    canActivate(context) {
        const client = context.switchToWs().getClient();
        const data = client.data;
        const user = data?.user;
        if (!user) {
            throw new websockets_1.WsException('Unauthorized');
        }
        return true;
    }
    verifyClient(client) {
        try {
            const token = this.extractToken(client);
            if (!token) {
                return false;
            }
            const payload = this.jwtService.verify(token);
            const user = this.userStore.findByGithubId(payload.sub);
            if (!user) {
                return false;
            }
            client.data = { user };
            return true;
        }
        catch {
            return false;
        }
    }
    extractToken(client) {
        const cookies = client.handshake.headers?.cookie;
        if (cookies) {
            const tokenMatch = cookies.match(/access_token=([^;]+)/);
            if (tokenMatch) {
                return tokenMatch[1];
            }
        }
        return null;
    }
};
exports.WsJwtGuard = WsJwtGuard;
exports.WsJwtGuard = WsJwtGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        user_store_1.UserStore])
], WsJwtGuard);
//# sourceMappingURL=ws-jwt.guard.js.map