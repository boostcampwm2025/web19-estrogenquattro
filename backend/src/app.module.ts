import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerModule } from './player/player.module';
import { GithubModule } from './github/github.module';
import { AuthModule } from './auth/auth.module';
import { envValidationSchema } from './config/env.validation';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './config/logger.winston';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ChatModule } from './chat/chat.module';
import { RoomModule } from './room/room.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import AppDataSource from './database/data-source';
import { TaskModule } from './task/task.module';
import { FocusTimeModule } from './focustime/focustime.module';
import { PetModule } from './userpet/pet.module';
import { PointModule } from './point/point.module';

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
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...AppDataSource.options,
      }),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: [
        '/api/*path',
        '/auth/github/*path',
        '/auth/me',
        '/auth/logout',
        '/socket.io/*path',
        '/metrics/*path',
      ],
      serveStaticOptions: {
        extensions: ['html'],
      },
    }),
    PlayerModule,
    GithubModule,
    AuthModule,
    ChatModule,
    RoomModule,
    TaskModule,
    FocusTimeModule,
    PetModule,
    PointModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
