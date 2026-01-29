import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACTIVITY_POINT_MAP } from '../point/point.service';
import { PointType } from '../pointhistory/entities/point-history.entity';
import { GlobalState } from './entities/global-state.entity';

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

// 타입 가드: contributions가 Record<string, number> 형식인지 검증
function isContributionsRecord(data: unknown): data is Record<string, number> {
  if (typeof data !== 'object' || data === null) return false;
  return Object.values(data).every((v) => typeof v === 'number');
}

// 상수 정의
const MAP_COUNT = 5;

@WebSocketGateway()
export class ProgressGateway implements OnModuleInit {
  private readonly logger = new Logger(ProgressGateway.name);

  @WebSocketServer()
  server: Server;

  // 전역 게임 상태 (단일 인스턴스)
  private globalState: GlobalGameState = {
    progress: 0,
    contributions: {},
    mapIndex: 0,
  };

  // Debounce용 타이머
  private persistTimer: NodeJS.Timeout | null = null;
  private readonly PERSIST_DEBOUNCE_MS = 1000; // 1초

  constructor(
    @InjectRepository(GlobalState)
    private globalStateRepository: Repository<GlobalState>,
  ) {}

  /**
   * 서버 시작 시 DB에서 상태 복원
   */
  async onModuleInit() {
    try {
      let saved = await this.globalStateRepository.findOne({
        where: { id: 1 },
      });

      if (!saved) {
        this.logger.warn(
          'GlobalState record missing - creating default (check migration)',
        );
        saved = await this.globalStateRepository.save({
          id: 1,
          progress: 0,
          contributions: '{}',
          mapIndex: 0,
        });
      }

      const parsedContributions: unknown = JSON.parse(saved.contributions);
      if (!isContributionsRecord(parsedContributions)) {
        this.logger.warn(
          'Invalid contributions format in DB, resetting to empty',
        );
      }

      this.globalState = {
        progress: saved.progress,
        contributions: isContributionsRecord(parsedContributions)
          ? parsedContributions
          : {},
        mapIndex: saved.mapIndex,
      };
      this.logger.log(
        `GlobalState restored: progress=${saved.progress}, mapIndex=${saved.mapIndex}`,
      );
    } catch (error) {
      this.logger.error('Failed to restore GlobalState', error);
    }
  }

  /**
   * 상태 변경 시 DB 저장 예약 (debounce 적용)
   */
  private schedulePersist() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      void this.persistState();
    }, this.PERSIST_DEBOUNCE_MS);
  }

  /**
   * DB에 현재 상태 저장
   */
  private async persistState() {
    try {
      await this.globalStateRepository.save({
        id: 1,
        progress: this.globalState.progress,
        contributions: JSON.stringify(this.globalState.contributions),
        mapIndex: this.globalState.mapIndex,
      });
      this.logger.debug(
        `GlobalState persisted: progress=${this.globalState.progress}, mapIndex=${this.globalState.mapIndex}`,
      );
    } catch (error) {
      this.logger.error('Failed to persist GlobalState', error);
    }
  }

  /**
   * 시즌 리셋 (스케줄러에서 호출)
   */
  public async resetSeason() {
    this.globalState = { progress: 0, contributions: {}, mapIndex: 0 };
    await this.persistState();
    this.server.emit('season_reset', { mapIndex: 0 });
    this.logger.log('Season reset completed');
  }

  /**
   * 현재 맵 인덱스 반환 (MapController에서 사용)
   */
  public getMapIndex(): number {
    return this.globalState.mapIndex;
  }

  /**
   * progress_update 이벤트 전송 (절대값 동기화)
   */
  public castProgressUpdate(
    username: string,
    source: ProgressSource,
    rawData: GithubEventData,
  ) {
    this.updateGlobalState(username, source, rawData);
    this.schedulePersist();

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
      const prevMapIndex = this.globalState.mapIndex;
      this.globalState.progress = 0; // 초과분 버림
      this.globalState.mapIndex = (this.globalState.mapIndex + 1) % MAP_COUNT;
      this.logger.log(
        `Map switch triggered: ${prevMapIndex} → ${this.globalState.mapIndex}`,
      );
      this.server.emit('map_switch', { mapIndex: this.globalState.mapIndex });
    }

    this.schedulePersist();

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
      const prevMapIndex = this.globalState.mapIndex;
      this.globalState.progress = 0; // 초과분 버림
      this.globalState.mapIndex = (this.globalState.mapIndex + 1) % MAP_COUNT;
      this.logger.log(
        `Map switch triggered: ${prevMapIndex} → ${this.globalState.mapIndex}`,
      );
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
