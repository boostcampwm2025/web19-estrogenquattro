"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const player_gateway_1 = require("./player.gateway");
const player_play_time_service_1 = require("./player.play-time-service");
const github_module_1 = require("../github/github.module");
const room_module_1 = require("../room/room.module");
let PlayerModule = class PlayerModule {
};
exports.PlayerModule = PlayerModule;
exports.PlayerModule = PlayerModule = __decorate([
    (0, common_1.Module)({
        imports: [github_module_1.GithubModule, auth_module_1.AuthModule, room_module_1.RoomModule],
        providers: [player_gateway_1.PlayerGateway, player_play_time_service_1.PlayTimeService],
    })
], PlayerModule);
//# sourceMappingURL=player.module.js.map