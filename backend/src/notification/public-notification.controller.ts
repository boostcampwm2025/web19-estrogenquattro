import { Controller, Get, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtGuard } from '../auth/jwt.guard';

@Controller('api/public/notifications')
@UseGuards(JwtGuard)
export class PublicNotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findAll() {
    return this.notificationService.findAll();
  }
}
