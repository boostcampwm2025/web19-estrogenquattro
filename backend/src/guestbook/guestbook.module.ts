import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guestbook } from './entities/guestbook.entity';
import { GuestbookService } from './guestbook.service';
import { GuestbookController } from './guestbook.controller';
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [TypeOrmModule.forFeature([Guestbook]), PlayerModule],
  controllers: [GuestbookController],
  providers: [GuestbookService],
  exports: [GuestbookService],
})
export class GuestbookModule {}
