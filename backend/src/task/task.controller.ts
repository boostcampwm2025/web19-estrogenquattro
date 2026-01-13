import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskReq } from './dto/create-task.req.dto';
import { TaskListRes } from './dto/task-list.res.dto';
import { TaskRes } from './dto/task.res.dto';

@Controller('api/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  async createTask(@Body() dto: CreateTaskReq): Promise<TaskRes> {
    return this.taskService.createTask(dto);
  }

  @Get(':playerId')
  async getTasks(
    @Param('playerId', ParseIntPipe) playerId: number,
    @Query('date') date?: string,
  ): Promise<TaskListRes> {
    return this.taskService.getTasks(playerId, date);
  }

  @Patch(':taskId')
  async toggleCompleteTask(
    @Param('taskId', ParseIntPipe) taskId: number,
  ): Promise<TaskRes> {
    return this.taskService.toggleCompleteTask(taskId);
  }
}
