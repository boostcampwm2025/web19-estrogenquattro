import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubGateway } from './github.gateway';
import { GithubPollService } from './github.poll-service';
import { GithubService } from './github.service';
import { GithubController } from './github.controller';
import { DailyGithubActivity } from './entities/daily-github-activity.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DailyGithubActivity])],
  controllers: [GithubController],
  providers: [GithubGateway, GithubPollService, GithubService],
  exports: [GithubGateway, GithubPollService, GithubService],
})
export class GithubModule {}
