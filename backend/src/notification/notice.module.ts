import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notice } from './entities/notice.entity';
import { NoticeService } from './notice.service';
import { NoticeController } from './notice.controller';
import { NoticeGateway } from './notice.gateway';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notice]), AdminModule, AuthModule],
  controllers: [NoticeController],
  providers: [NoticeService, NoticeGateway],
})
export class NoticeModule {}

