import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { UserStore } from './user.store';
export interface JwtPayload {
    sub: string;
    username: string;
}
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private userStore;
    private readonly logger;
    constructor(userStore: UserStore, configService: ConfigService);
    validate(payload: JwtPayload): false | import("./user.interface").User;
}
export {};
