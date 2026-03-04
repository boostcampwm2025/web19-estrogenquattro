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
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { PlayerId } from '../auth/player-id.decorator';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('api/bug-reports')
@UseGuards(JwtGuard)
export class BugReportController {
  constructor(private readonly bugReportService: BugReportService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('images', 3, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, file.mimetype.startsWith('image/'));
      },
    }),
  )
  async create(
    @PlayerId() playerId: number,
    @Body() dto: CreateBugReportDto,
    @UploadedFiles()
    images?: { buffer: Buffer; originalname: string; mimetype: string }[],
  ) {
    return this.bugReportService.create(playerId, dto, images);
  }
}
