"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfiguredSocketIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const frontend_urls_1 = require("./frontend-urls");
class ConfiguredSocketIoAdapter extends platform_socket_io_1.IoAdapter {
    configService;
    constructor(app, configService) {
        super(app);
        this.configService = configService;
    }
    createIOServer(port, options) {
        const frontendUrls = (0, frontend_urls_1.getFrontendUrls)(this.configService);
        const baseCors = {
            origin: frontendUrls,
            credentials: true,
        };
        const cors = options?.cors && typeof options.cors === 'object'
            ? { ...options.cors, ...baseCors }
            : baseCors;
        return super.createIOServer(port, {
            ...options,
            cors,
        });
    }
}
exports.ConfiguredSocketIoAdapter = ConfiguredSocketIoAdapter;
//# sourceMappingURL=socket-io.adapter.js.map