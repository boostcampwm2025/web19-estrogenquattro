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
  controllers: [AuthController],
  providers: [UserStore, GithubStrategy, JwtStrategy, WsJwtGuard],
  exports: [UserStore, JwtModule, WsJwtGuard],
})
export class AuthModule {}
