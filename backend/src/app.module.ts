import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ServerResponse } from 'http';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerModule } from './player/player.module';
import { GithubModule } from './github/github.module';
import { AuthModule } from './auth/auth.module';
import { envValidationSchema } from './config/env.validation';
import { ENV_FILE_PATHS } from './config/env-files';
import { WinstonModule } from 'nest-winston';
import { createWinstonConfig } from './config/logger.winston';
import { ConfigService } from '@nestjs/config';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ChatModule } from './chat/chat.module';
import { RoomModule } from './room/room.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import AppDataSource from './database/data-source';
import { TaskModule } from './task/task.module';
import { FocusTimeModule } from './focustime/focustime.module';
import { PetModule } from './userpet/pet.module';
import { PointModule } from './point/point.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { DatabaseModule } from './database/database.module';
import { GuestbookModule } from './guestbook/guestbook.module';
import { BugReportModule } from './bugreport/bug-report.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [...ENV_FILE_PATHS],
      validationSchema: envValidationSchema,
    }),
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return createWinstonConfig(
          config.get('NODE_ENV', 'development'),
          config.get('AXIOM_TOKEN'),
          config.get('AXIOM_DATASET'),
          config.get('LOG_LEVEL'),
        );
      },
    }),
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
    DatabaseModule,
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
        setHeaders: (res: ServerResponse, path: string) => {
          if (path.endsWith('.html')) {
            res.setHeader(
              'Cache-Control',
              'no-cache, no-store, must-revalidate',
            );
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (path.includes('/_next/static/')) {
            res.setHeader(
              'Cache-Control',
              'public, max-age=31536000, immutable',
            );
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
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
    SchedulerModule,
    GuestbookModule,
    BugReportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
