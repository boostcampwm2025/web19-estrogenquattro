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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const github_guard_1 = require("./github.guard");
const jwt_guard_1 = require("./jwt.guard");
const frontend_urls_1 = require("../config/frontend-urls");
let AuthController = AuthController_1 = class AuthController {
    jwtService;
    configService;
    logger = new common_1.Logger(AuthController_1.name);
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
    }
    github() {
    }
    githubCallback(req, res) {
        const user = req.user;
        this.logger.log(`GitHub callback - username: ${user.username}`);
        const token = this.jwtService.sign({
            sub: user.githubId,
            username: user.username,
        });
        this.logger.log(`JWT token generated for user: ${user.username}`);
        const cookieOptions = {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
        };
        this.logger.log(`Setting cookie with options: ${JSON.stringify(cookieOptions)}`);
        res.cookie('access_token', token, cookieOptions);
        const frontendUrls = (0, frontend_urls_1.getFrontendUrls)(this.configService);
        const frontendUrl = frontendUrls[0];
        this.logger.log(`Redirecting to: ${frontendUrl}/auth/callback`);
        res.redirect(`${frontendUrl}/auth/callback`);
    }
    me(req) {
        const { githubId, username, avatarUrl } = req.user;
        const userInfo = { githubId, username, avatarUrl };
        this.logger.log(`/me called - username: ${userInfo.username}`);
        return userInfo;
    }
    logout(res) {
        res.clearCookie('access_token');
        const frontendUrls = (0, frontend_urls_1.getFrontendUrls)(this.configService);
        res.redirect(frontendUrls[0]);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('github'),
    (0, common_1.UseGuards)(github_guard_1.GithubGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "github", null);
__decorate([
    (0, common_1.Get)('github/callback'),
    (0, common_1.UseGuards)(github_guard_1.GithubGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "githubCallback", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_guard_1.JwtGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('logout'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map