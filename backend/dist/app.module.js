"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const serve_static_1 = require("@nestjs/serve-static");
const path_1 = require("path");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const player_module_1 = require("./player/player.module");
const github_module_1 = require("./github/github.module");
const auth_module_1 = require("./auth/auth.module");
const env_validation_1 = require("./config/env.validation");
const nest_winston_1 = require("nest-winston");
const logger_winston_1 = require("./config/logger.winston");
const nestjs_prometheus_1 = require("@willsoto/nestjs-prometheus");
const chat_gateway_1 = require("./chat/chat.gateway");
const chat_module_1 = require("./chat/chat.module");
const room_module_1 = require("./room/room.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env.production', '.env.local', '.env'],
                validationSchema: env_validation_1.envValidationSchema,
            }),
            nest_winston_1.WinstonModule.forRoot(logger_winston_1.winstonConfig),
            nestjs_prometheus_1.PrometheusModule.register({
                path: '/metrics',
                defaultMetrics: {
                    enabled: true,
                },
            }),
            serve_static_1.ServeStaticModule.forRoot({
                rootPath: (0, path_1.join)(__dirname, '..', 'public'),
                exclude: [
                    '/api/*path',
                    '/auth/github/*path',
                    '/auth/me',
                    '/auth/logout',
                    '/socket.io/*path',
                    '/metrics/*path',
                ],
            }),
            player_module_1.PlayerModule,
            github_module_1.GithubModule,
            auth_module_1.AuthModule,
            chat_module_1.ChatModule,
            room_module_1.RoomModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService, chat_gateway_1.ChatGateway],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map