import { Module } from '@nestjs/common';
import { GithubGateway } from './github.gateway';
import { GithubPollService } from './github.poll-service';

@Module({
  providers: [GithubGateway, GithubPollService],
  exports: [GithubGateway, GithubPollService], // 다른 모듈에서 사용할 수 있도록 export
})
export class GithubModule {}
