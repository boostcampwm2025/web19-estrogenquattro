import { Module } from '@nestjs/common';
import { GithubGateway } from './github.gateway';
import { GithubPollService } from './github.poll-service';

@Module({
  providers: [GithubGateway, GithubPollService],
})
export class GithubModule {}
