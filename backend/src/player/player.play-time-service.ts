import { Injectable } from '@nestjs/common';

interface PlayTimer {
  connectedTime: Date;
  minutes: number;
  interval: NodeJS.Timeout;
}

@Injectable()
export class PlayTimeService {
  private readonly sessionTimers = new Map<string, PlayTimer>();

  public startTimer(socketId: string, onMinute: (minutes: number) => void) {
    if (this.sessionTimers.has(socketId)) {
      return;
    }

    const timer: PlayTimer = {
      connectedTime: new Date(),
      minutes: 0,
      interval: setInterval(() => this.handleTimer(timer, onMinute), 60_000),
    };

    this.sessionTimers.set(socketId, timer);
  }

  public stopTimer(socketId: string) {
    const timer = this.sessionTimers.get(socketId);

    if (!timer) {
      return;
    }

    clearInterval(timer.interval);
    this.sessionTimers.delete(socketId);
  }

  private handleTimer(timer: PlayTimer, onMinute: (minutes: number) => void) {
    timer.minutes += 1;
    onMinute(timer.minutes);
  }
}
