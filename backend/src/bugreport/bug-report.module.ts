import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BugReport } from './entities/bug-report.entity';
import { BugReportService } from './bug-report.service';
import { BugReportController } from './bug-report.controller';
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [TypeOrmModule.forFeature([BugReport]), PlayerModule],
  controllers: [BugReportController],
  providers: [BugReportService],
})
export class BugReportModule {}
