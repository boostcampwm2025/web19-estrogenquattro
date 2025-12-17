import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlayerModule } from './player/player.module';
import { PlayerGateway } from './player/player.gateway';

@Module({
  imports: [PlayerModule],
  controllers: [AppController],
  providers: [AppService, PlayerGateway],
})
export class AppModule {}
