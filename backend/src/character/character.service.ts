import { Injectable } from '@nestjs/common';

interface SessionTimer {
  connectedTime: Date;
  minutes: number;
  interval: NodeJS.Timeout;
}

@Injectable()
export class CharacterService {
  private readonly sessionTimers = new Map<string, SessionTimer>();

  public startSessionTimer(
    socketId: string,
    onMinute: (minutes: number) => void,
  ) {
    if (this.sessionTimers.has(socketId)) {
      return;
    }

    const timer: SessionTimer = {
      connectedTime: new Date(),
      minutes: 0,
      interval: setInterval(() => this.handleTimer(timer, onMinute), 60_000),
    };

    this.sessionTimers.set(socketId, timer);
  }

  public stopSessionTimer(socketId: string) {
    const timer = this.sessionTimers.get(socketId);

    if (!timer) {
      return;
    }

    clearInterval(timer.interval);
    this.sessionTimers.delete(socketId);
  }

  private handleTimer(
    timer: SessionTimer,
    onMinute: (minutes: number) => void,
  ) {
    timer.minutes += 1;
    onMinute(timer.minutes);
  }
}
