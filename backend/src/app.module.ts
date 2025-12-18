import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerModule } from './player/player.module';
import { PlayerGateway } from './player/player.gateway';
import { PlayTimeService } from './player/player.play-time-service';
import { GithubModule } from './github/github.module';
import { GithubPollService } from './github/github.poll-service';
import { GithubGateway } from './github/github.gateway';
import { AuthModule } from './auth/auth.module';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.production', '.env.local', '.env'],
      validationSchema: envValidationSchema,
    }),
    PlayerModule,
    GithubModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PlayerGateway,
    PlayTimeService,
    GithubPollService,
    GithubGateway,
  ],
})
export class AppModule {}
