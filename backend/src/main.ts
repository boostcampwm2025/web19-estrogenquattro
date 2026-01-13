import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { getFrontendUrls } from './config/frontend-urls';
import { ConfiguredSocketIoAdapter } from './config/socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());
  const frontendUrls = getFrontendUrls(configService);
  app.useWebSocketAdapter(new ConfiguredSocketIoAdapter(app, configService));

  app.enableCors({
    origin: frontendUrls,
    credentials: true,
  });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  await app.listen(configService.getOrThrow<number>('PORT'));
}
void bootstrap();
