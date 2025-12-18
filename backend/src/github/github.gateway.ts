import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface GithubEventData {
  username: string;
  pushCount: number;
  pullRequestCount: number;
}

export interface RoomGithubState {
  progress: number;
  contributions: Record<string, number>; // username -> count
}

// 프로그레스 증가량 설정 (프론트엔드와 동일)
const PROGRESS_PER_COMMIT = 2;
const PROGRESS_PER_PR = 5;

@WebSocketGateway()
export class GithubGateway {
  @WebSocketServer()
  server: Server;

  // 룸별 기여 상태 저장
  private roomStates = new Map<string, RoomGithubState>();

  public castGithubEventToRoom(githubEvent: GithubEventData, roomId: string) {
    // 룸 상태 업데이트
    this.updateRoomState(roomId, githubEvent);

    this.server.to(roomId).emit('github_event', githubEvent);
  }

  private updateRoomState(roomId: string, event: GithubEventData) {
    let state = this.roomStates.get(roomId);
    if (!state) {
      state = { progress: 0, contributions: {} };
      this.roomStates.set(roomId, state);
    }

    // 프로그레스 업데이트
    const progressIncrement =
      event.pushCount * PROGRESS_PER_COMMIT +
      event.pullRequestCount * PROGRESS_PER_PR;
    state.progress = (state.progress + progressIncrement) % 100;

    // 기여도 업데이트
    const totalCount = event.pushCount + event.pullRequestCount;
    state.contributions[event.username] =
      (state.contributions[event.username] || 0) + totalCount;
  }

  public getRoomState(roomId: string): RoomGithubState {
    return this.roomStates.get(roomId) || { progress: 0, contributions: {} };
  }
}
