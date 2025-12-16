import { Injectable } from '@nestjs/common';

interface SessionTimer {
  interval: NodeJS.Timeout;
  minutes: number;
}

@Injectable()
export class CharacterService {
  private sessionTimers = new Map<string, SessionTimer>();

  public startSessionTimer(
    socketId: string,
    onMinute: (minutes: number) => void,
  ) {
    if (this.sessionTimers.has(socketId)) {
      return;
    }

    const timer: SessionTimer = {
      minutes: 0,
      interval: setInterval(() => {
        timer.minutes += 1;
        onMinute(timer.minutes);
      }, 60_000),
    };

    this.sessionTimers.set(socketId, timer);
  }
}
