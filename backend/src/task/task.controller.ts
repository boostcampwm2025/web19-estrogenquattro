import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskReq } from './dto/create-task.req.dto';
import { UpdateTaskReq } from './dto/update-task.req.dto';
import { TaskListRes } from './dto/task-list.res.dto';
import { TaskRes } from './dto/task.res.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { PlayerId } from '../auth/player-id.decorator';

@UseGuards(JwtGuard)
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

  @Patch('completion/:taskId')
  async completeTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @PlayerId() playerId: number,
  ): Promise<TaskRes> {
    return this.taskService.completeTask(taskId, playerId);
  }

  @Patch('uncompletion/:taskId')
  async uncompleteTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @PlayerId() playerId: number,
  ): Promise<TaskRes> {
    return this.taskService.uncompleteTask(taskId, playerId);
  }

  @Patch(':taskId')
  async updateTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTaskReq,
    @PlayerId() playerId: number,
  ): Promise<TaskRes> {
    return this.taskService.updateTask(taskId, dto.description, playerId);
  }

  @Delete(':taskId')
  async deleteTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @PlayerId() playerId: number,
  ): Promise<void> {
    return this.taskService.deleteTask(taskId, playerId);
  }
}
