import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from './user.interface';

export const PlayerId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: User }>();
    const user = req.user;
    const playerId = user?.playerId;

    if (!playerId) {
      throw new UnauthorizedException('Missing playerId in authenticated user');
    }

    return playerId;
  },
);
