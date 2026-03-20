import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserStore } from './user.store';
import { PlayerModule } from '../player/player.module';
import { GithubStrategy } from './github.strategy';
import { JwtStrategy } from './jwt.strategy';
import { WsJwtGuard } from './ws-jwt.guard';
import { AuthController } from './auth.controller';
import { AuthProfileSyncService } from './auth-profile-sync.service';
import { AuthSessionService } from './auth-session.service';
import { PlaywrightAuthController } from './playwright-auth.controller';
import { loadEnvFilesOnce } from '../config/env-files';

loadEnvFilesOnce();

const isPlaywrightAuthControllerEnabled =
  process.env.NODE_ENV !== 'production' &&
  process.env.PLAYWRIGHT_TEST_MODE === 'true';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => PlayerModule),
  ],
  controllers: isPlaywrightAuthControllerEnabled
    ? [AuthController, PlaywrightAuthController]
    : [AuthController],
  providers: [
    UserStore,
    GithubStrategy,
    JwtStrategy,
    WsJwtGuard,
    AuthSessionService,
    AuthProfileSyncService,
  ],
  exports: [UserStore, JwtModule, WsJwtGuard],
})
export class AuthModule {}
