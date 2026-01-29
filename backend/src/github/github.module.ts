import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressGateway } from './progress.gateway';
import { GithubPollService } from './github.poll-service';
import { GithubService } from './github.service';
import { GithubController } from './github.controller';
import { MapController } from './map.controller';
import { DailyGithubActivity } from './entities/daily-github-activity.entity';
import { GlobalState } from './entities/global-state.entity';
import { PointModule } from '../point/point.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyGithubActivity, GlobalState]),
    PointModule,
  ],
  controllers: [GithubController, MapController],
  providers: [ProgressGateway, GithubPollService, GithubService],
  exports: [ProgressGateway, GithubPollService, GithubService],
})
export class GithubModule {}
