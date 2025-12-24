import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlayerGateway } from './player.gateway';
import { PlayTimeService } from './player.play-time-service';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [GithubModule, AuthModule],
  providers: [PlayerGateway, PlayTimeService],
})
export class PlayerModule {}
