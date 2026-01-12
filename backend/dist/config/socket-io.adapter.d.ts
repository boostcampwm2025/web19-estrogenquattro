import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
export declare class ConfiguredSocketIoAdapter extends IoAdapter {
    private readonly configService;
    constructor(app: INestApplicationContext, configService: ConfigService);
    createIOServer(port: number, options?: ServerOptions): Server;
}
