import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
import { getFrontendUrls } from './frontend-urls';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const customParser = require('socket.io-msgpack-parser');

export class ConfiguredSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const frontendUrls = getFrontendUrls(this.configService);
    const baseCors = {
      origin: frontendUrls,
      credentials: true,
    };
    const cors =
      options?.cors && typeof options.cors === 'object'
        ? { ...options.cors, ...baseCors }
        : baseCors;

    return super.createIOServer(port, {
      ...options,
      cors,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      parser: customParser,
    }) as Server;
  }
}
