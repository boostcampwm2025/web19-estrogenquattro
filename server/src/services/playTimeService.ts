interface PlayTimer {
  connectedAt: Date;
  minutes: number;
  interval: NodeJS.Timeout;
  username: string;
}

class PlayTimeService {
  private readonly sessionTimers = new Map<string, PlayTimer>();
  // username -> 누적 분 (새로고침해도 유지)
  private readonly userMinutes = new Map<string, number>();

  public startTimer(
    socketId: string,
    username: string,
    onMinute: (minutes: number) => void,
    connectedAt: Date,
  ): void {
    if (this.sessionTimers.has(socketId)) {
      return;
    }

    // 이전 누적 시간 복원
    const previousMinutes = this.userMinutes.get(username) || 0;

    const timer: PlayTimer = {
      connectedAt,
      minutes: previousMinutes,
      interval: setInterval(() => this.handleTimer(timer, onMinute), 60_000),
      username,
    };

    this.sessionTimers.set(socketId, timer);
  }

  public stopTimer(socketId: string): void {
    const timer = this.sessionTimers.get(socketId);

    if (!timer) {
      return;
    }

    // 누적 시간 저장
    this.userMinutes.set(timer.username, timer.minutes);

    clearInterval(timer.interval);
    this.sessionTimers.delete(socketId);
  }

  public getUserMinutes(username: string): number {
    // 활성 타이머가 있으면 그 값 반환
    for (const timer of this.sessionTimers.values()) {
      if (timer.username === username) {
        return timer.minutes;
      }
    }
    // 없으면 저장된 누적값 반환
    return this.userMinutes.get(username) || 0;
  }

  private handleTimer(
    timer: PlayTimer,
    onMinute: (minutes: number) => void,
  ): void {
    timer.minutes += 1;
    // 누적 시간도 함께 갱신
    this.userMinutes.set(timer.username, timer.minutes);
    onMinute(timer.minutes);
  }
}

// 싱글톤 인스턴스
export const playTimeService = new PlayTimeService();
