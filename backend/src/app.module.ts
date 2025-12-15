import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CharacterModule } from './character/character.module';
import { CharactersModule } from './characters/characters.module';
import { CharaterGateway } from './charater/charater.gateway';
import { CharacterModule } from './character/character.module';

@Module({
  imports: [CharacterModule, CharactersModule],
  controllers: [AppController],
  providers: [AppService, CharaterGateway],
})
export class AppModule {}
