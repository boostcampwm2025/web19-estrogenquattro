import { Module } from '@nestjs/common';
import {CharacterGateway} from "./character.gateway";

@Module({
  providers: [CharacterGateway]
})
export class CharacterModule {}
