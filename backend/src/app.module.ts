import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CharacterModule } from './character/character.module';
import { CharacterGateway } from './character/character.gateway';

@Module({
  imports: [CharacterModule],
  controllers: [AppController],
  providers: [AppService, CharacterGateway],
})
export class AppModule {}
