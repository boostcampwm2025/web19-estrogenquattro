import { CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { UserStore } from './user.store';
export declare class WsJwtGuard implements CanActivate {
    private jwtService;
    private userStore;
    constructor(jwtService: JwtService, userStore: UserStore);
    canActivate(context: ExecutionContext): boolean;
    verifyClient(client: Socket): boolean;
    private extractToken;
}
