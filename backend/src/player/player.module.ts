import { Module } from '@nestjs/common';
import { PlayerGateway } from './player.gateway';
import { PlayTimeService } from './player.play-time-service';
import { GithubModule } from '../github/github.module';
import { GithubPollService } from '../github/github.poll-service';

@Module({
  imports: [GithubModule],
  providers: [PlayerGateway, PlayTimeService, GithubPollService],
})
export class PlayerModule {}
