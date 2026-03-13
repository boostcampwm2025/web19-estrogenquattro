import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { AdminGuard } from './admin.guard';

@Controller('api/admin')
@UseGuards(JwtGuard, AdminGuard)
export class AdminController {
  @Get('verification')
  verify() {
    return { isAdmin: true };
  }
}
