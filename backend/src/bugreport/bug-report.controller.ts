import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { BugReportService } from './bug-report.service';
import { PlayerId } from '../auth/player-id.decorator';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('api/bug-reports')
@UseGuards(JwtGuard)
export class BugReportController {
  constructor(private readonly bugReportService: BugReportService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('images', 3))
  async create(
    @PlayerId() playerId: number,
    @Body('content') content: string,
    @UploadedFiles() images?: { buffer: Buffer; originalname: string; mimetype: string }[],
  ) {
    return this.bugReportService.create(playerId, content, images);
  }
}
