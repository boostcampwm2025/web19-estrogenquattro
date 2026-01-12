import { ConfigService } from '@nestjs/config';
import { Strategy, Profile } from 'passport-github2';
import { UserStore } from './user.store';
declare const GithubStrategy_base: new (...args: [options: import("passport-github2").StrategyOptionsWithRequest] | [options: import("passport-github2").StrategyOptions]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class GithubStrategy extends GithubStrategy_base {
    private userStore;
    private readonly logger;
    constructor(userStore: UserStore, configService: ConfigService);
    validate(accessToken: string, refreshToken: string, profile: Profile): import("./user.interface").User;
}
export {};
