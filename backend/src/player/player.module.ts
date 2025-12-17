import { Module } from '@nestjs/common';
import { CharacterGateway } from './character.gateway';
import { CharacterService } from './character.service';

@Module({
  providers: [CharacterGateway, CharacterService]
})
export class CharacterModule {}
