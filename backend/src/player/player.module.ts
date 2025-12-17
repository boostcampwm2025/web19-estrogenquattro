import { Module } from '@nestjs/common';
import { PlayerGateway } from './player.gateway';
import { PlayTimeService } from './player.play-time-service';

@Module({
  providers: [PlayerGateway, PlayTimeService],
})
export class PlayerModule {}
