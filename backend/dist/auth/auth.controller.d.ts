import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import type { UserInfo } from './user.interface';
export declare class AuthController {
    private jwtService;
    private configService;
    private readonly logger;
    constructor(jwtService: JwtService, configService: ConfigService);
    github(): void;
    githubCallback(req: Request, res: Response): void;
    me(req: Request): UserInfo;
    logout(res: Response): void;
}
