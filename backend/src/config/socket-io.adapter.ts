import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { getFrontendUrls } from './frontend-urls';

export class ConfiguredSocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
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
    });
  }
}
