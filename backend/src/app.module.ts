import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerModule } from './player/player.module';
import { PlayerGateway } from './player/player.gateway';
import { PlayTimeService } from './player/player.play-time-service';
import { AuthModule } from './auth/auth.module';
import { envValidationSchema } from './config/env.validation';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './config/logger.winston';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.production', '.env.local', '.env'],
      validationSchema: envValidationSchema,
    }),
    WinstonModule.forRoot(winstonConfig),
    PlayerModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, PlayerGateway, PlayTimeService],
})
export class AppModule {}
