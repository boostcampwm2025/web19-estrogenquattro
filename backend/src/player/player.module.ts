import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlayerGateway } from './player.gateway';
import { PlayTimeService } from './player.play-time-service';
import { GithubModule } from '../github/github.module';
import { GithubPollService } from '../github/github.poll-service';
import { GithubGateway } from '../github/github.gateway';

@Module({
  imports: [GithubModule],
  providers: [PlayerGateway, PlayTimeService, GithubPollService, GithubGateway],
})
export class PlayerModule {}
