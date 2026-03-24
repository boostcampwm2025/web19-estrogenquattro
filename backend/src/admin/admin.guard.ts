import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../auth/user.interface';
import { AdminService } from './admin.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly adminService: AdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: User }>();
    const playerId = req.user?.playerId;

    if (!playerId) {
      throw new UnauthorizedException('Missing playerId in authenticated user');
    }

    await this.adminService.validateAdmin(playerId);
    return true;
  }
}
