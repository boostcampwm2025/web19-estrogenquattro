import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Task } from '../task/entites/task.entity';
import { DailyFocusTime } from '../focustime/entites/daily-focus-time.entity';
import { PointModule } from '../point/point.module';
import { GithubModule } from '../github/github.module';
import { PointSettlementScheduler } from './point-settlement.scheduler';
import { SeasonResetScheduler } from './season-reset.scheduler';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Task, DailyFocusTime]),
    PointModule,
    GithubModule,
  ],
  providers: [PointSettlementScheduler, SeasonResetScheduler],
})
export class SchedulerModule {}
