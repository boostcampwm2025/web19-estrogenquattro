import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { PlayerModule } from '../player/player.module';
import { Task } from './entites/task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Task]), PlayerModule],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TypeOrmModule, TaskService],
})
export class TaskModule {}
