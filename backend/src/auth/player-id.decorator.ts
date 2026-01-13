import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from './user.interface';

export const PlayerId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as User | undefined;
    const playerId = user?.playerId;

    if (!playerId) {
      throw new UnauthorizedException('Missing playerId in authenticated user');
    }

    return playerId;
  },
);
