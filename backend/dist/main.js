"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const nest_winston_1 = require("nest-winston");
const frontend_urls_1 = require("./config/frontend-urls");
const socket_io_adapter_1 = require("./config/socket-io.adapter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    app.use((0, cookie_parser_1.default)());
    const frontendUrls = (0, frontend_urls_1.getFrontendUrls)(configService);
    app.useWebSocketAdapter(new socket_io_adapter_1.ConfiguredSocketIoAdapter(app, configService));
    app.enableCors({
        origin: frontendUrls,
        credentials: true,
    });
    app.useLogger(app.get(nest_winston_1.WINSTON_MODULE_NEST_PROVIDER));
    await app.listen(configService.getOrThrow('PORT'));
}
void bootstrap();
//# sourceMappingURL=main.js.map