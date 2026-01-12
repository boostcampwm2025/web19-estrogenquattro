import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerModule } from './player/player.module';
import { GithubModule } from './github/github.module';
import { AuthModule } from './auth/auth.module';
import { envValidationSchema } from './config/env.validation';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './config/logger.winston';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ChatGateway } from './chat/chat.gateway';
import { ChatModule } from './chat/chat.module';
import { RoomModule } from './room/room.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.production', '.env.local', '.env'],
      validationSchema: envValidationSchema,
    }),
    WinstonModule.forRoot(winstonConfig),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    PlayerModule,
    GithubModule,
    AuthModule,
    ChatModule,
    RoomModule,
  ],
  controllers: [AppController],
  providers: [AppService, ChatGateway],
})
export class AppModule {}
