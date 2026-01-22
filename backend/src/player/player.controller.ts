import { Controller, Get, Patch, Body, UseGuards, Param } from '@nestjs/common';
import { PlayerService } from './player.service';
import { JwtGuard } from '../auth/jwt.guard';
import { PlayerId } from '../auth/player-id.decorator';
import { PetService } from '../userpet/pet.service';
import { EquipPetDto } from '../userpet/dto/equip-pet.dto';

@Controller('api/players')
@UseGuards(JwtGuard)
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly petService: PetService,
  ) {}

  @Get(':playerId/info')
  async getPlayerInfo(@Param('playerId') playerId: number) {
    return this.playerService.findOneById(playerId);
  }

  @Patch('me/equipped-pet')
  async equipPet(@PlayerId() playerId: number, @Body() dto: EquipPetDto) {
    await this.petService.equipPet(dto.petId, playerId);
    return { success: true };
  }
}
