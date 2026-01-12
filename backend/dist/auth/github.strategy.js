"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GithubStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const passport_1 = require("@nestjs/passport");
const passport_github2_1 = require("passport-github2");
const user_store_1 = require("./user.store");
let GithubStrategy = GithubStrategy_1 = class GithubStrategy extends (0, passport_1.PassportStrategy)(passport_github2_1.Strategy, 'github') {
    userStore;
    logger = new common_1.Logger(GithubStrategy_1.name);
    constructor(userStore, configService) {
        super({
            clientID: configService.getOrThrow('GITHUB_CLIENT_ID'),
            clientSecret: configService.getOrThrow('GITHUB_CLIENT_SECRET'),
            callbackURL: configService.getOrThrow('GITHUB_CALLBACK_URL'),
            scope: ['repo'],
        });
        this.userStore = userStore;
    }
    validate(accessToken, refreshToken, profile) {
        const username = (profile.username && profile.username.trim()) ||
            (profile.displayName && profile.displayName.trim()) ||
            `github-${profile.id}`;
        this.logger.log(`GitHub OAuth validated - username: ${username}`);
        const user = this.userStore.findOrCreate({
            githubId: profile.id,
            username,
            avatarUrl: profile.photos?.[0]?.value || '',
            accessToken,
        });
        this.logger.log(`User stored/found - username: ${user.username}`);
        return user;
    }
};
exports.GithubStrategy = GithubStrategy;
exports.GithubStrategy = GithubStrategy = GithubStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_store_1.UserStore,
        config_1.ConfigService])
], GithubStrategy);
//# sourceMappingURL=github.strategy.js.map