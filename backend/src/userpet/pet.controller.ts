import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { PetService } from './pet.service';
import { JwtGuard } from '../auth/jwt.guard';
import { FeedPetDto } from './dto/feed-pet.dto';
import { EvolvePetDto } from './dto/evolve-pet.dto';
import { PlayerId } from '../auth/player-id.decorator';

@Controller('api/pets')
@UseGuards(JwtGuard)
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Get('inventory/:playerId')
  async getInventory(@Param('playerId', ParseIntPipe) playerId: number) {
    return this.petService.getInventory(playerId);
  }

  @Post('gacha')
  async gacha(@PlayerId() playerId: number) {
    return this.petService.gacha(playerId);
  }

  @Post('gacha/refund')
  async gachaRefund(@PlayerId() playerId: number) {
    return this.petService.refundGachaCost(playerId);
  }

  @Post('feed')
  async feed(@PlayerId() playerId: number, @Body() dto: FeedPetDto) {
    return this.petService.feed(dto.userPetId, playerId);
  }

  @Post('evolve')
  async evolve(@PlayerId() playerId: number, @Body() dto: EvolvePetDto) {
    return this.petService.evolve(dto.userPetId, playerId);
  }

  @Get('codex/:playerId')
  async getCodex(@Param('playerId', ParseIntPipe) playerId: number) {
    return this.petService.getCodex(playerId);
  }

  @Get('all')
  async getAllPets() {
    return this.petService.getAllPets();
  }
}
