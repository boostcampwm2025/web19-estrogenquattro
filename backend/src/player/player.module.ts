import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlayerGateway } from './player.gateway';
import { PlayTimeService } from './player.play-time-service';

@Module({
  imports: [AuthModule],
  providers: [PlayerGateway, PlayTimeService],
})
export class PlayerModule {}
