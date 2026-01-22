import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyFocusTime } from './entites/daily-focus-time.entity';
import { Task } from '../task/entites/task.entity';
import { FocusTimeService } from './focustime.service';
import { FocusTimeGateway } from './focustime.gateway';
import { FocustimeController } from './focustime.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DailyFocusTime, Task])],
  controllers: [FocustimeController],
  providers: [FocusTimeService, FocusTimeGateway],
  exports: [FocusTimeService],
})
export class FocusTimeModule {}
