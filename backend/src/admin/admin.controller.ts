import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from './admin.guard';

@Controller('api/admin')
export class AdminController {
  @Get('verification')
  @UseGuards(JwtGuard, AdminGuard)
  verify() {
    return { isAdmin: true };
  }
}
