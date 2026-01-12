"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStore = void 0;
const common_1 = require("@nestjs/common");
let UserStore = class UserStore {
    users = new Map();
    findByGithubId(githubId) {
        return this.users.get(githubId);
    }
    save(user) {
        this.users.set(user.githubId, user);
        return user;
    }
    findOrCreate(user) {
        const existingUser = this.findByGithubId(user.githubId);
        if (existingUser) {
            existingUser.accessToken = user.accessToken;
            return existingUser;
        }
        return this.save(user);
    }
};
exports.UserStore = UserStore;
exports.UserStore = UserStore = __decorate([
    (0, common_1.Injectable)()
], UserStore);
//# sourceMappingURL=user.store.js.map