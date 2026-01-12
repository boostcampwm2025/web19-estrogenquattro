"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayTimeService = void 0;
const common_1 = require("@nestjs/common");
let PlayTimeService = class PlayTimeService {
    sessionTimers = new Map();
    userMinutes = new Map();
    startTimer(socketId, username, onMinute, connectedAt) {
        if (this.sessionTimers.has(socketId)) {
            return;
        }
        const previousMinutes = this.userMinutes.get(username) || 0;
        const timer = {
            connectedAt,
            minutes: previousMinutes,
            interval: setInterval(() => this.handleTimer(timer, onMinute), 60_000),
            username,
        };
        this.sessionTimers.set(socketId, timer);
    }
    stopTimer(socketId) {
        const timer = this.sessionTimers.get(socketId);
        if (!timer) {
            return;
        }
        this.userMinutes.set(timer.username, timer.minutes);
        clearInterval(timer.interval);
        this.sessionTimers.delete(socketId);
    }
    getUserMinutes(username) {
        for (const timer of this.sessionTimers.values()) {
            if (timer.username === username) {
                return timer.minutes;
            }
        }
        return this.userMinutes.get(username) || 0;
    }
    handleTimer(timer, onMinute) {
        timer.minutes += 1;
        this.userMinutes.set(timer.username, timer.minutes);
        onMinute(timer.minutes);
    }
};
exports.PlayTimeService = PlayTimeService;
exports.PlayTimeService = PlayTimeService = __decorate([
    (0, common_1.Injectable)()
], PlayTimeService);
//# sourceMappingURL=player.play-time-service.js.map