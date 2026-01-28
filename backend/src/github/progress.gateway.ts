import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ACTIVITY_POINT_MAP } from '../point/point.service';
import { PointType } from '../pointhistory/entities/point-history.entity';

// poll-service에서 사용하는 GitHub 이벤트 데이터
export interface GithubEventData {
  username: string;
  commitCount: number;
  prCount: number;
  mergeCount: number;
  issueCount: number;
  reviewCount: number;
}

// 기여 출처 enum
export enum ProgressSource {
  GITHUB = 'github',
  TASK = 'task',
  FOCUSTIME = 'focustime',
}

// 서버 내부 상태
export interface GlobalGameState {
  progress: number;
  contributions: Record<string, number>;
  mapIndex: number;
}

// progress_update 이벤트 페이로드 (S→C)
export interface ProgressUpdateData {
  username: string;
  source: ProgressSource;
  targetProgress: number;
  contributions: Record<string, number>;
  mapIndex: number;
}

// game_state 이벤트 페이로드 (S→C, 입장 시)
export interface GameStateData {
  progress: number;
  contributions: Record<string, number>;
  mapIndex: number;
}

// 상수 정의
const MAP_COUNT = 5;

@WebSocketGateway()
export class ProgressGateway {
  @WebSocketServer()
  server: Server;

  // 전역 게임 상태 (단일 인스턴스)
  private globalState: GlobalGameState = {
    progress: 0,
    contributions: {},
    mapIndex: 0,
  };

  /**
   * progress_update 이벤트 전송 (절대값 동기화)
   */
  public castProgressUpdate(
    username: string,
    source: ProgressSource,
    rawData: GithubEventData,
  ) {
    this.updateGlobalState(username, source, rawData);

    const payload: ProgressUpdateData = {
      username,
      source,
      targetProgress: this.globalState.progress,
      contributions: { ...this.globalState.contributions },
      mapIndex: this.globalState.mapIndex,
    };
    this.server.emit('progress_update', payload);
  }

  /**
   * 단순 progress 추가 (Task/FocusTime용)
   * addPoint와 나란히 호출
   */
  public addProgress(username: string, source: ProgressSource, count: number) {
    let progressIncrement = 0;

    if (source === ProgressSource.TASK) {
      progressIncrement = count * ACTIVITY_POINT_MAP[PointType.TASK_COMPLETED];
    } else if (source === ProgressSource.FOCUSTIME) {
      progressIncrement = count * ACTIVITY_POINT_MAP[PointType.FOCUSED];
    }

    if (progressIncrement === 0) return;

    this.globalState.progress += progressIncrement;
    this.globalState.contributions[username] =
      (this.globalState.contributions[username] || 0) + count;

    // 100% 도달 시 맵 전환
    if (this.globalState.progress >= 100) {
      this.globalState.progress = 0; // 초과분 버림
      this.globalState.mapIndex = (this.globalState.mapIndex + 1) % MAP_COUNT;
      this.server.emit('map_switch', { mapIndex: this.globalState.mapIndex });
    }

    const payload: ProgressUpdateData = {
      username,
      source,
      targetProgress: this.globalState.progress,
      contributions: { ...this.globalState.contributions },
      mapIndex: this.globalState.mapIndex,
    };
    this.server.emit('progress_update', payload);
  }

  private updateGlobalState(
    username: string,
    source: ProgressSource,
    rawData: GithubEventData,
  ) {
    let progressIncrement = 0;
    let contributionCount = 0;

    if (source === ProgressSource.GITHUB) {
      progressIncrement =
        rawData.commitCount * ACTIVITY_POINT_MAP[PointType.COMMITTED] +
        rawData.prCount * ACTIVITY_POINT_MAP[PointType.PR_OPEN] +
        rawData.mergeCount * ACTIVITY_POINT_MAP[PointType.PR_MERGED] +
        rawData.issueCount * ACTIVITY_POINT_MAP[PointType.ISSUE_OPEN] +
        rawData.reviewCount * ACTIVITY_POINT_MAP[PointType.PR_REVIEWED];
      contributionCount =
        rawData.commitCount +
        rawData.prCount +
        rawData.mergeCount +
        rawData.issueCount +
        rawData.reviewCount;
    }

    this.globalState.progress += progressIncrement;
    this.globalState.contributions[username] =
      (this.globalState.contributions[username] || 0) + contributionCount;

    // 100% 도달 시 맵 전환
    if (this.globalState.progress >= 100) {
      this.globalState.progress = 0; // 초과분 버림
      this.globalState.mapIndex = (this.globalState.mapIndex + 1) % MAP_COUNT;
      this.server.emit('map_switch', { mapIndex: this.globalState.mapIndex });
    }
  }

  /**
   * 전역 게임 상태 조회 (입장 시 game_state 이벤트용)
   */
  public getGlobalState(): GameStateData {
    return {
      progress: this.globalState.progress,
      contributions: { ...this.globalState.contributions },
      mapIndex: this.globalState.mapIndex,
    };
  }
}
