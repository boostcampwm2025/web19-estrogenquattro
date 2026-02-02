import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyFocusTime } from './entites/daily-focus-time.entity';
import { Task } from '../task/entites/task.entity';
import { Player } from '../player/entites/player.entity';
import { FocusTimeService } from './focustime.service';
import { FocusTimeGateway } from './focustime.gateway';
import { FocustimeController } from './focustime.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyFocusTime, Task, Player]),
    AuthModule,
  ],
  controllers: [FocustimeController],
  providers: [FocusTimeService, FocusTimeGateway],
  exports: [FocusTimeService],
})
export class FocusTimeModule {}
