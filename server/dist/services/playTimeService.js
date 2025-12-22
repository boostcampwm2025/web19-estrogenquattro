class PlayTimeService {
    sessionTimers = new Map();
    // username -> 누적 분 (새로고침해도 유지)
    userMinutes = new Map();
    startTimer(socketId, username, onMinute, connectedAt) {
        if (this.sessionTimers.has(socketId)) {
            return;
        }
        // 이전 누적 시간 복원
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
        // 누적 시간 저장
        this.userMinutes.set(timer.username, timer.minutes);
        clearInterval(timer.interval);
        this.sessionTimers.delete(socketId);
    }
    getUserMinutes(username) {
        // 활성 타이머가 있으면 그 값 반환
        for (const timer of this.sessionTimers.values()) {
            if (timer.username === username) {
                return timer.minutes;
            }
        }
        // 없으면 저장된 누적값 반환
        return this.userMinutes.get(username) || 0;
    }
    handleTimer(timer, onMinute) {
        timer.minutes += 1;
        // 누적 시간도 함께 갱신
        this.userMinutes.set(timer.username, timer.minutes);
        onMinute(timer.minutes);
    }
}
// 싱글톤 인스턴스
export const playTimeService = new PlayTimeService();
//# sourceMappingURL=playTimeService.js.map