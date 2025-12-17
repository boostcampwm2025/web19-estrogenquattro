import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerModule } from './player/player.module';
import { PlayerGateway } from './player/player.gateway';
import { PlayTimeService } from './player/player.play-time-service';

@Module({
  imports: [PlayerModule],
  controllers: [AppController],
  providers: [AppService, PlayerGateway, PlayTimeService],
})
export class AppModule {}
