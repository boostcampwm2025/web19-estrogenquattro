# PR 2: globalState 영속화 + 시즌 리셋 + 맵 Lazy Loading

> 2026-01-28 작성

## 브랜치

`fix/#214-global-state-persist`

## 포함 이슈

| 이슈 | 제목 | 역할 |
|------|------|------|
| [#214](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/214) | 서버 재시작 시 프로그레스/기여도 초기화 | 핵심 작업 |
| [#290](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/290) | 새로고침 시 프로그레스바/기여도 동기화 문제 | Part 1.5 |
| [#276](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/276) | 1주일마다 프로그레스/맵 초기화 (시즌 리셋) | 함께 작업 |
| [#219](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/219) | 맵 이미지 미리보기 방지 | 함께 작업 |

## 선행 조건

- [x] PR 1 머지 완료 (#241, #201 해결)

---

## 변경 요약

| 항목 | 현재 | 변경 후 |
|------|------|--------|
| 상태 저장 | 메모리만 | 메모리 + DB |
| 서버 시작 | 기본값으로 초기화 | DB에서 복원 |
| 상태 변경 | 메모리만 업데이트 | 메모리 + DB 저장 (debounce) |
| 새로고침 동기화 | game_state 이벤트 타이밍 이슈 | 즉시 동기화되도록 점검/수정 |
| 시즌 | 없음 | 매주 월요일 00:00 리셋 |
| 맵 로딩 | 전체 5개 public 서빙 | 백엔드 권한 체크 후 서빙 |

---

## Part 1: globalState 영속화 (#214)

### 문제 분석

```typescript
// backend/src/github/progress.gateway.ts
private globalState: GlobalGameState = {
  progress: 0,
  contributions: {},
  mapIndex: 0,
};
```

**문제점:**
- 서버 재시작(pm2 restart, 배포) 시 `globalState` 초기화
- 메모리에만 저장, 영속화 없음

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/entities/global-state.entity.ts` | 신규 생성 |
| `backend/src/database/migrations/XXXX-CreateGlobalState.ts` | 신규 생성 |
| `backend/src/github/progress.gateway.ts` | OnModuleInit 복원, persistState 저장 |
| `backend/src/github/github.module.ts` | GlobalState 엔티티 import |

> **Note:** `data-source.ts`는 `**/*.entity.{ts,js}` glob 패턴으로 엔티티를 자동 로드하므로 변경 불필요

### 상세 구현

#### 1.1 GlobalState 엔티티 생성

**파일**: `backend/src/github/entities/global-state.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('global_state')
export class GlobalState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 0 })
  progress: number;

  @Column({ type: 'text', default: '{}' })
  contributions: string; // JSON string

  @Column({ name: 'map_index', default: 0 })
  mapIndex: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

#### 1.2 마이그레이션 생성

**파일**: `backend/src/database/migrations/1738000000000-CreateGlobalState.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGlobalState1738000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE global_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        progress INTEGER DEFAULT 0,
        contributions TEXT DEFAULT '{}',
        map_index INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 초기 레코드 삽입 (싱글톤)
    await queryRunner.query(`
      INSERT INTO global_state (progress, contributions, map_index)
      VALUES (0, '{}', 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE global_state`);
  }
}
```

#### 1.3 ProgressGateway 수정

**파일**: `backend/src/github/progress.gateway.ts`

```typescript
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnModuleInit, Logger } from '@nestjs/common';
import { GlobalState } from './entities/global-state.entity';

@WebSocketGateway()
export class ProgressGateway implements OnModuleInit {
  private readonly logger = new Logger(ProgressGateway.name);

  // Debounce용 타이머
  private persistTimer: NodeJS.Timeout | null = null;
  private readonly PERSIST_DEBOUNCE_MS = 1000; // 1초

  constructor(
    @InjectRepository(GlobalState)
    private globalStateRepository: Repository<GlobalState>,
  ) {}

  /**
   * 서버 시작 시 DB에서 상태 복원
   * 레코드가 없으면 생성 (마이그레이션 누락, DB 초기화 등 대비)
   */
  async onModuleInit() {
    try {
      let saved = await this.globalStateRepository.findOne({
        where: { id: 1 },
      });

      if (!saved) {
        // 레코드가 없으면 생성 (비정상 상황이지만 자동 복구)
        // id: 1로 고정하여 persistState()와 일관성 유지
        this.logger.warn('GlobalState record missing - creating default (check migration)');
        saved = await this.globalStateRepository.save({
          id: 1,
          progress: 0,
          contributions: '{}',
          mapIndex: 0,
        });
      }

      this.globalState = {
        progress: saved.progress,
        contributions: JSON.parse(saved.contributions),
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
   * 상태 변경 시 DB에 저장 (debounce 적용)
   */
  private schedulePersist() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(async () => {
      await this.persistState();
    }, this.PERSIST_DEBOUNCE_MS);
  }

  private async persistState() {
    try {
      // save()는 id가 있으면 UPDATE, 없으면 INSERT (upsert)
      // @UpdateDateColumn 자동 갱신도 save()에서만 동작
      await this.globalStateRepository.save({
        id: 1,
        progress: this.globalState.progress,
        contributions: JSON.stringify(this.globalState.contributions),
        mapIndex: this.globalState.mapIndex,
      });
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

  // 기존 메서드에 schedulePersist() 추가
  public castProgressUpdate(/* ... */) {
    this.updateGlobalState(/* ... */);
    this.schedulePersist(); // 추가
    // ...
  }

  public addProgress(/* ... */) {
    // ...
    this.schedulePersist(); // 추가
    // ...
  }
}
```

---

## Part 1.5: 새로고침 시 동기화 문제 해결 (#290) ✅

### 문제 분석

**현상:**
- 새로고침 시 기여도 목록이 표시되지 않음
- 프로그레스바는 정상 동작

**원인 분석 결과:**
- `game_state` 이벤트 발송/수신은 정상
- 문제: `mapIndex`가 다를 때 맵 전환이 발생하는데, `setContributions()`가 맵 전환 **전에** 호출됨
- 맵 전환 시 `contributionController`가 새로 생성되어 기존 데이터 손실

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/game/managers/SocketManager.ts` | pendingContributions 패턴 도입 |

### 해결 방안: pendingContributions 패턴

#### 1. SocketManager에 pendingContributions 필드 추가

```typescript
private pendingContributions?: Record<string, number>;
```

#### 2. game_state/progress_update 핸들러 수정

맵 전환이 필요한 경우 contributions를 pending으로 저장:

```typescript
socket.on("game_state", (data: GameStateData) => {
  useProgressStore.getState().setProgress(data.progress);

  const needsMapSync = data.mapIndex !== this.currentMapIndex;
  if (needsMapSync) {
    // 맵 전환 시 contributionController가 새로 생성되므로 pending으로 저장
    this.pendingContributions = data.contributions;
    callbacks.onMapSyncRequired(data.mapIndex);
    this.currentMapIndex = data.mapIndex;
  } else {
    this.contributionController?.setContributions(data.contributions);
  }
});
```

#### 3. setContributionController에서 pending 적용

```typescript
setContributionController(controller: ContributionController) {
  this.contributionController = controller;
  if (this.pendingContributions) {
    controller.setContributions(this.pendingContributions);
    this.pendingContributions = undefined;
  }
}
```

---

## Part 2: 시즌 리셋 스케줄러 (#276)

### 목적

- 1주일(시즌) 단위로 프로그레스/기여도 초기화
- 매주 월요일 00:00 KST 실행

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/scheduler/season-reset.scheduler.ts` | 신규 생성 |
| `backend/src/scheduler/scheduler.module.ts` | SeasonResetScheduler 추가 |

### 상세 구현

#### 2.1 SeasonResetScheduler 생성

**파일**: `backend/src/scheduler/season-reset.scheduler.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProgressGateway } from '../github/progress.gateway';

@Injectable()
export class SeasonResetScheduler {
  private readonly logger = new Logger(SeasonResetScheduler.name);

  constructor(private readonly progressGateway: ProgressGateway) {}

  /**
   * 매주 월요일 00:00 (KST) 시즌 리셋
   * Cron: 초 분 시 일 월 요일
   * '0 0 0 * * 1' = 매주 월요일 00:00:00
   */
  @Cron('0 0 0 * * 1', { timeZone: 'Asia/Seoul' })
  async handleSeasonReset() {
    this.logger.log('Season reset started');
    await this.progressGateway.resetSeason();
  }
}
```

#### 2.2 SchedulerModule 수정

**파일**: `backend/src/scheduler/scheduler.module.ts`

```typescript
import { SeasonResetScheduler } from './season-reset.scheduler';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [
    // ...
    GithubModule, // ProgressGateway 사용을 위해 추가
  ],
  providers: [
    // ...
    SeasonResetScheduler,
  ],
})
export class SchedulerModule {}
```

### 클라이언트 처리

**파일**: `frontend/src/game/managers/SocketManager.ts`

```typescript
import { useProgressStore } from "@/stores/useProgressStore";

// season_reset 이벤트 핸들러 추가
// 위치: connect(callbacks) 메서드 내부 (callbacks는 MapScene에서 전달받은 콜백 객체)
socket.on('season_reset', (data: { mapIndex: number }) => {
  useProgressStore.getState().setProgress(0);
  this.contributionController?.setContributions({});
  callbacks.onMapSyncRequired(data.mapIndex);
  // TODO: 시즌 리셋 알림 UI 표시 (선택)
});
```

---

## Part 3: 맵 이미지 백엔드 서빙 (#219)

### 목적

- 해금되지 않은 맵 이미지 스포일러 완벽 차단
- **현재 맵만 접근 허용** (인증 불필요, globalState.mapIndex 기준)

### 방안

**백엔드 서빙 + 권한 체크**: 맵 이미지를 API 엔드포인트로 서빙하고, globalState.mapIndex 기준으로 접근 제어

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/map.controller.ts` | 신규 생성 - 맵 이미지 서빙 |
| `backend/src/github/github.module.ts` | MapController 추가 |
| `backend/src/github/progress.gateway.ts` | getMapIndex() 메서드 추가 |
| `backend/src/config/env.validation.ts` | ASSETS_PATH 환경변수 추가 |
| `frontend/src/game/scenes/MapScene.ts` | 이미지 URL 변경 |
| `frontend/public/assets/maps/` → `backend/assets/maps/` | 맵 이미지 이동 |

### 상세 구현

#### 3.1 MapController 생성

**파일**: `backend/src/github/map.controller.ts`

```typescript
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as path from 'path';
import { ProgressGateway } from './progress.gateway';

// 맵 개수 상수 (프론트엔드와 동기화 필요)
const TOTAL_MAP_COUNT = 5;

@Controller('api/maps')
export class MapController {
  private readonly assetsPath: string;

  constructor(
    private readonly progressGateway: ProgressGateway,
    private readonly configService: ConfigService,
  ) {
    // 환경변수 또는 __dirname 기반 경로
    this.assetsPath = this.configService.get<string>('ASSETS_PATH')
      ?? path.join(__dirname, '..', '..', 'assets');
  }

  /**
   * 맵 이미지 서빙 (권한 체크)
   * 현재 맵만 접근 허용 (인증 불필요)
   */
  @Get(':index')
  getMap(
    @Param('index', ParseIntPipe) index: number,
    @Res() res: Response,
  ) {
    const currentMapIndex = this.progressGateway.getMapIndex();

    // 현재 맵만 허용
    if (index !== currentMapIndex) {
      throw new ForbiddenException('Map not unlocked yet');
    }

    const stageNum = index + 1;
    const filePath = path.join(
      this.assetsPath,
      'maps',
      `desert_stage${stageNum}.webp`,
    );

    res.sendFile(filePath);
  }
}
```

#### 3.2 환경변수 검증 추가

**파일**: `backend/src/config/env.validation.ts`

```typescript
export const envValidationSchema = Joi.object({
  // ... 기존 환경변수 ...

  // 선택 환경변수 - 맵 에셋 경로 (미설정 시 __dirname 기반)
  ASSETS_PATH: Joi.string().optional(),
});
```

**환경별 권장값:**

| 환경 | ASSETS_PATH | 설명 |
|------|-------------|------|
| 개발 (pnpm start:dev) | 생략 | `__dirname` 기반 자동 해석 → `backend/assets/` |
| PM2 (cwd=./backend) | 생략 또는 `./assets` | `backend/assets/` 사용 |
| Docker | `/app/assets` | 컨테이너 내 절대 경로 명시 권장 |

> **Note:** `backend/assets/`는 빌드 대상(src)이 아니므로 dist로 복사되지 않음. `__dirname` 기반 경로(`../../assets`)는 개발/빌드 모두 `backend/assets/`를 가리킴.

#### 3.3 ProgressGateway에 getter 추가

**파일**: `backend/src/github/progress.gateway.ts`

```typescript
/**
 * 현재 맵 인덱스 반환 (MapController에서 사용)
 */
public getMapIndex(): number {
  return this.globalState.mapIndex;
}
```

#### 3.4 GithubModule 수정

**파일**: `backend/src/github/github.module.ts`

```typescript
import { MapController } from './map.controller';

@Module({
  // ...
  controllers: [MapController],
  // ...
})
export class GithubModule {}
```

#### 3.5 맵 이미지 이동

```bash
# frontend/public/assets/maps/ → backend/assets/maps/
mkdir -p backend/assets/maps
mv frontend/public/assets/maps/desert_stage*.webp backend/assets/maps/
```

#### 3.6 프론트엔드 URL 변경

> **Note:** Phaser의 `this.load.image()`는 `fetchApi`를 사용하지 않으므로, 개발 환경에서도 백엔드로 요청이 가도록 `API_URL`을 명시해야 함

**파일**: `frontend/src/game/scenes/MapScene.ts`

```typescript
import { API_URL } from "@/lib/api/client";

// 변경 전
this.load.image(`map_stage${i}`, `/assets/maps/desert_stage${i}.webp`);

// 변경 후
this.load.image(`map_stage${i}`, `${API_URL}/api/maps/${i - 1}`);
```

**파일**: `frontend/src/game/managers/MapManager.ts`

```typescript
import { API_URL } from "@/lib/api/client";

// 변경 전
this.scene.load.image(mapKey, `/assets/maps/desert_stage${stageNum}.webp`);

// 변경 후
this.scene.load.image(mapKey, `${API_URL}/api/maps/${index}`);
```

---

## 작업 순서

```
1. [ ] 브랜치 생성: fix/#214-global-state-persist

=== Part 1: globalState 영속화 (#214) ===
2. [x] 엔티티 생성
   2.1 [x] global-state.entity.ts 생성
   (data-source.ts는 glob 패턴으로 자동 로드되므로 변경 불필요)
3. [x] 마이그레이션 생성 및 실행
   3.1 [x] pnpm migration:generate로 Auto 마이그레이션 생성 (1769615965615-Auto.ts)
   3.2 [x] pnpm migration:run
4. [x] ProgressGateway 수정
   4.1 [x] constructor에 Repository 주입
   4.2 [x] OnModuleInit 구현 (복원 로직)
   4.3 [x] schedulePersist, persistState 구현
   4.4 [x] resetSeason 메서드 추가
   4.5 [x] castProgressUpdate에 schedulePersist 추가
   4.6 [x] addProgress에 schedulePersist 추가
   4.7 [x] getMapIndex() 메서드 추가 (Part 3용 선작업)
5. [x] GithubModule 수정
   5.1 [x] TypeOrmModule.forFeature에 GlobalState 추가

=== Part 1.5: 새로고침 동기화 (#290) ===
6. [x] game_state 이벤트 점검
   6.1 [x] 백엔드: joining 시 game_state 발송 확인 (정상)
   6.2 [x] 프론트엔드: game_state 수신 확인 (정상)
   6.3 [x] 타이밍 이슈 발견 및 수정
       - 원인: 맵 전환 시 contributionController가 새로 생성되어 데이터 손실
       - 해결: pendingContributions 패턴 도입 (game_state, progress_update 핸들러)

=== Part 2: 시즌 리셋 (#276) ===
7. [ ] SeasonResetScheduler 생성
   7.1 [ ] season-reset.scheduler.ts 생성
   7.2 [ ] Cron 데코레이터 설정 (매주 월요일 00:00 KST)
8. [ ] SchedulerModule 수정
   8.1 [ ] GithubModule import 추가
   8.2 [ ] SeasonResetScheduler provider 추가
9. [ ] 클라이언트 season_reset 핸들러 추가

=== Part 3: 맵 이미지 백엔드 서빙 (#219) ===
10. [ ] 맵 이미지 이동
    10.1 [ ] frontend/public/assets/maps/ → backend/assets/maps/
11. [ ] 환경변수 검증 추가
    11.1 [ ] env.validation.ts에 ASSETS_PATH 추가 (선택 환경변수)
12. [ ] MapController 생성
    12.1 [ ] map.controller.ts 생성
    12.2 [ ] getMap() 엔드포인트 구현 (권한 체크)
    12.3 [ ] ConfigService 주입, assetsPath 설정
13. [x] ProgressGateway 수정 (Part 1에서 완료)
    13.1 [x] getMapIndex() 메서드 추가
14. [ ] GithubModule 수정
    14.1 [ ] MapController 추가
15. [ ] 프론트엔드 URL 변경
    15.1 [ ] MapScene.ts - API_URL import + 이미지 URL 변경
    15.2 [ ] MapManager.ts - API_URL import + 이미지 URL 변경

=== 마무리 ===
16. [ ] 문서 업데이트
    16.1 [ ] SOCKET_EVENTS.md에 season_reset 이벤트 추가
    16.2 [ ] REST_ENDPOINTS.md에 /api/maps/:index 추가
    16.3 [ ] ENVIRONMENT.md에 ASSETS_PATH 환경변수 추가
17. [ ] 테스트
18. [ ] PR 생성
19. [ ] 리뷰 & 머지
20. [ ] #214, #290, #219, #276 이슈 Close
```

---

## 테스트 체크리스트

### Part 1: 영속화 테스트

- [x] 서버 시작 시 DB에서 상태 복원 확인 (로그 확인)
  - `[ProgressGateway] GlobalState restored: progress=50, mapIndex=2`
- [x] GitHub 활동 후 DB에 상태 저장 확인 (debounce 1초 후)
- [x] 서버 재시작 후 progress 유지 확인 (50 → 50)
- [x] 서버 재시작 후 contributions 유지 확인 (`{"testuser":5}`)
- [x] 서버 재시작 후 mapIndex 유지 확인 (2 → 2)

### Part 1.5: 새로고침 동기화 테스트

- [x] 새로고침 시 프로그레스바 값 유지 확인 (50 → 50)
- [x] 새로고침 시 기여도 목록 표시 확인 (`testuser:5`)
- [x] 새로고침 시 맵 인덱스 동기화 확인 (mapIndex 2 → stage 3 맵 표시)

### Part 2: 시즌 리셋 테스트

- [x] 스케줄러 동작 확인 (로그 또는 수동 트리거)
- [x] 리셋 후 progress=0, contributions={}, mapIndex=0 확인
- [x] 클라이언트에서 season_reset 이벤트 수신 확인
- [x] 모든 클라이언트 맵 동기화 확인

**테스트 방법:**

```bash
# 1. Cron을 테스트용으로 변경 (매분 0초 실행)
# backend/src/scheduler/season-reset.scheduler.ts
@Cron('0 * * * * *', { timeZone: 'Asia/Seoul' })

# 2. 테스트 데이터 설정
sqlite3 data/jandi.sqlite "UPDATE global_state SET progress=80, contributions='{\"testuser\":10}', map_index=3 WHERE id=1;"

# 3. 서버 재시작
cd backend && pnpm start:dev

# 4. 게임 접속 후 1분 대기

# 5. 확인
# - 백엔드 로그: [SeasonResetScheduler] Season reset started
# - 브라우저 콘솔: [SocketManager] season_reset received: {mapIndex: 0}
# - UI: 프로그레스바 0%, 기여도 목록 비어있음, stage1 맵

# 6. DB 확인
sqlite3 data/jandi.sqlite "SELECT * FROM global_state WHERE id=1;"
# 예상: 1|0|{}|0|...

# ⚠️ 테스트 완료 후 Cron 원복 필수!
@Cron('0 0 0 * * 1', { timeZone: 'Asia/Seoul' })
```

### Part 3: 맵 동적 로드 + 권한 체크 테스트

**권한 체크 (현재 맵만 허용, 인증 불필요):**
- [x] `/api/maps/{currentMapIndex}` 접근 시 맵 이미지 반환 (200 OK, Content-Type: image/webp)
- [x] `/api/maps/{currentMapIndex + 1}` 접근 시 403 Forbidden
- [x] `/api/maps/{currentMapIndex + 2}` 접근 시 403 Forbidden
- [x] 기존 `/assets/maps/...` URL 접근 시 이미지 반환 안 됨 (Content-Type: text/html)

**테스트 방법 (권한 체크):**

```bash
# 현재 맵 인덱스 확인
sqlite3 data/jandi.sqlite "SELECT map_index FROM global_state WHERE id=1;"
# 예: 0

# 현재 맵 → 200 OK + 이미지
curl -i http://localhost:8080/api/maps/0 | head -10
# Content-Type: image/webp ← 이미지 정상 반환

# 다음 맵 → 403 Forbidden
curl -i http://localhost:8080/api/maps/1

# 그 외 맵 → 403 Forbidden
curl -i http://localhost:8080/api/maps/2
curl -i http://localhost:8080/api/maps/3
curl -i http://localhost:8080/api/maps/4

# 기존 정적 경로 → HTML 반환 (이미지 아님, SPA fallback)
curl -i http://localhost:8080/assets/maps/desert_stage1.webp | head -10
# Content-Type: text/html ← 이미지 아님 (스포일러 방지 OK)
```

**동적 로드:**
- [x] 첫 접속 시 game_state 수신 → 현재 맵 동적 로드 → 게임 시작
- [x] 새로고침 시 맵 동적 로드 정상 동작
- [x] 맵 전환 시 (progress 100%) 다음 맵 동적 로드 후 전환
- [x] 맵 로드 중 UI 표시 (fade out/in)

**테스트 방법 (동적 로드):**

```bash
# 첫 접속 테스트
# 1. 브라우저 캐시 비우기 (Ctrl+Shift+Delete)
# 2. 게임 접속
# 3. Network 탭에서 /api/maps/X 요청 확인
# 4. Console: [SocketManager] game_state received: {...}

# 새로고침 테스트
# 1. mapIndex 설정
sqlite3 data/jandi.sqlite "UPDATE global_state SET map_index=2 WHERE id=1;"
# 2. 서버 재시작 → 게임 접속 → 새로고침
# 3. Network 탭에서 /api/maps/2 요청 확인

# 맵 전환 테스트 (progress 100%)
# 1. progress=99로 설정
sqlite3 data/jandi.sqlite "UPDATE global_state SET progress=99, map_index=0 WHERE id=1;"
# 2. 서버 재시작 → 게임 접속
# 3. GitHub 커밋으로 progress +1 (또는 Task 완료)
# 4. 백엔드 로그: [ProgressGateway] Map switch triggered: 0 → 1
# 5. 브라우저: fade out/in → stage2 맵 표시
```

**에러 케이스:**
- [x] 403 응답 시 게임 정상 동작 (권한 없는 맵 요청 시)
- [x] 네트워크 에러 시 재시도 또는 에러 표시

**테스트 방법 (에러 케이스):**

```javascript
// 브라우저 콘솔에서 실행
fetch('http://localhost:8080/api/maps/4')
  .then(res => console.log('Status:', res.status))
// 403 반환되지만 게임은 정상 동작해야 함
```

### 통합 테스트

- [x] 시즌 리셋 후 서버 재시작해도 리셋 상태 유지 확인
- [x] 시즌 리셋 후 맵 0 동적 로드 정상 동작

**테스트 방법:**

```bash
# 1. 데이터 설정
sqlite3 data/jandi.sqlite "UPDATE global_state SET progress=80, map_index=3 WHERE id=1;"

# 2. 서버 시작 → 시즌 리셋 대기 (Cron 테스트용 변경 상태에서)

# 3. 리셋 후 DB 확인
sqlite3 data/jandi.sqlite "SELECT * FROM global_state WHERE id=1;"
# 예상: 1|0|{}|0|...

# 4. 서버 재시작

# 5. 다시 DB 확인 → 동일하게 0, {}, 0 유지
# 6. 게임 접속 → stage1 맵, 프로그레스 0%, Network에서 /api/maps/0 요청 확인
```

### 환경별 URL 테스트

**개발 환경 (프론트 3000 + 백엔드 8080):**
- [x] 첫 접속 시 맵 동적 로드 정상 동작
- [x] `/api/maps/:index` 권한 체크 정상 동작
- [x] 기존 REST API (`/api/tasks`, `/api/focustime` 등) 정상 동작
- [x] Socket.io 연결 정상 동작

**테스트 방법:**

```bash
# 1. 터미널 2개로 서버 실행
cd backend && pnpm start:dev   # :8080
cd frontend && pnpm dev        # :3000

# 2. http://localhost:3000 접속
# 3. Network 탭에서 /api/maps/:index 요청 확인
# 4. REST API 테스트: curl http://localhost:8080/api/tasks
# 5. Socket.io 연결 확인: 게임 접속 후 플레이어 이동
```

**프로덕션 환경 (백엔드 8080 단독, 정적 빌드 서빙):**
- [x] 첫 접속 시 맵 동적 로드 정상 동작
- [x] `/api/maps/:index` 권한 체크 정상 동작
- [x] 기존 REST API 정상 동작
- [x] Socket.io 연결 정상 동작
- [x] 정적 파일 서빙 정상 동작

**테스트 방법:**

```bash
# 1. 프론트엔드 빌드
cd frontend && pnpm build  # → backend/public으로 출력

# 2. 백엔드만 실행
cd backend && pnpm start

# 3. http://localhost:8080 접속
# 4. 위와 동일한 테스트 수행
```

---

## 테스트 가이드 (로그 확인 방법)

### 로그 레벨 설정

백엔드 `debug` 로그를 보려면 NestJS 로그 레벨을 조정하거나, `LOG_LEVEL=debug` 환경변수 사용

### Part 1: 영속화 테스트

#### 서버 시작 시 DB에서 상태 복원 확인

```bash
# 액션
cd backend && pnpm start:dev

# 확인할 로그 (ProgressGateway)
[ProgressGateway] GlobalState restored: progress=50, mapIndex=2
```

#### GitHub 활동 후 DB에 상태 저장 확인 (debounce 1초 후)

```bash
# 액션
# 1. GitHub에서 커밋/PR 생성
# 2. 120초 후 폴링 감지

# 확인할 로그
[GithubPollService] New events (1):
[GithubPollService] COMMIT: "feat: 테스트" (owner/repo)
[ProgressGateway] GlobalState persisted: progress=2, mapIndex=0
```

#### DB 직접 확인

```bash
sqlite3 backend/data/app.db "SELECT * FROM global_state WHERE id=1;"
# 결과: 1|50|{"testuser":5}|2|2026-01-29 ...
```

---

### Part 2: 시즌 리셋 테스트

#### 스케줄러 수동 테스트

테스트 시 `season-reset.scheduler.ts`의 Cron을 임시 변경:

```typescript
// 매분 0초에 실행 (테스트용)
@Cron('0 * * * * *', { timeZone: 'Asia/Seoul' })
```

```bash
# 확인할 로그 (백엔드)
[SeasonResetScheduler] Season reset started
[ProgressGateway] Season reset completed
```

#### 클라이언트 이벤트 수신 확인

```javascript
// 확인할 콘솔 (브라우저 DevTools)
[SocketManager] season_reset received: {mapIndex: 0}
```

#### 리셋 후 DB 확인

```bash
sqlite3 backend/data/app.db "SELECT * FROM global_state WHERE id=1;"
# 결과: 1|0|{}|0|2026-01-29 ...
```

---

### Part 3: 맵 권한 체크 테스트

#### 맵 API 권한 체크 (curl)

```bash
# 현재 맵이 0일 때
curl -i http://localhost:8080/api/maps/0   # 200 OK
curl -i http://localhost:8080/api/maps/1   # 403 Forbidden
curl -i http://localhost:8080/api/maps/2   # 403 Forbidden

# 기존 정적 경로 (404 확인)
curl -i http://localhost:8080/assets/maps/desert_stage1.webp
# HTTP/1.1 404 Not Found
```

```bash
# 확인할 로그 (백엔드)
[MapController] Map request: index=0, currentMapIndex=0
[MapController] Map request: index=1, currentMapIndex=0
[MapController] Map access denied: requested=1, current=0
```

---

### Part 3: 맵 동적 로드 테스트

#### 첫 접속 시 맵 동적 로드

```javascript
// 확인할 콘솔 (브라우저 DevTools)
[SocketManager] game_state received: {progress: 50, contributions: {...}, mapIndex: 2}
[SocketManager] Initial map load: 2
```

#### 새로고침 시 맵 동기화

```javascript
// 맵 인덱스가 다를 경우
[SocketManager] game_state received: {progress: 50, contributions: {...}, mapIndex: 3}
[SocketManager] Map sync required: 2 → 3
```

#### 맵 전환 (progress 100% 도달)

```bash
# 확인할 로그 (백엔드)
[ProgressGateway] Map switch triggered: 0 → 1
```

```javascript
// 확인할 콘솔 (브라우저 DevTools)
[SocketManager] map_switch received: {mapIndex: 1}
```

#### progress_update로 맵 동기화 (map_switch 유실 복구)

```javascript
// 확인할 콘솔 (브라우저 DevTools)
[SocketManager] progress_update received: {username: "test", source: "github", targetProgress: 5, contributions: {...}, mapIndex: 2}
[SocketManager] Map sync from progress_update: 0 → 2
```

---

### 로그 추가 요약

| 파일 | 로그 | 레벨 | 목적 |
|------|------|------|------|
| `progress.gateway.ts` | `GlobalState persisted: ...` | debug | DB 저장 확인 |
| `progress.gateway.ts` | `Map switch triggered: ...` | log | 맵 전환 확인 |
| `map.controller.ts` | `Map request: ...` | debug | 권한 체크 요청 |
| `map.controller.ts` | `Map access denied: ...` | warn | 접근 거부 |
| `SocketManager.ts` | `game_state received: ...` | console | 초기 상태 수신 |
| `SocketManager.ts` | `progress_update received: ...` | console | 프로그레스 업데이트 |
| `SocketManager.ts` | `map_switch received: ...` | console | 맵 전환 이벤트 |
| `SocketManager.ts` | `season_reset received: ...` | console | 시즌 리셋 이벤트 |

### ⚠️ PR 전 로그 정리

테스트 완료 후 **PR 전에 반드시 제거/정리해야 할 로그:**

| 파일 | 제거 대상 | 이유 |
|------|----------|------|
| `SocketManager.ts` | `console.log("[SocketManager] ...")` 전부 | 프로덕션 콘솔 오염 방지 |
| `progress.gateway.ts` | `debug` 로그 유지 가능 | 운영 시 로그 레벨로 제어 |
| `map.controller.ts` | `debug` 로그 유지 가능 | 운영 시 로그 레벨로 제어 |
| `season-reset.scheduler.ts` | Cron 원복 (`0 0 0 * * 1`) | 매분 실행 방지 |

**정리 명령어:**

```bash
# 프론트엔드 console.log 제거
cd frontend
grep -n "console.log.*SocketManager" src/game/managers/SocketManager.ts
# 해당 라인들 삭제

# Cron 원복 확인
grep -n "@Cron" ../backend/src/scheduler/season-reset.scheduler.ts
# '0 0 0 * * 1' 인지 확인
```

---

## PR 본문 템플릿

```markdown
## 🔗 관련 이슈

- close: #214
- close: #290
- close: #219
- close: #276

## ✅ 작업 내용

### 1. globalState 영속화 (#214)
- `global_state` 테이블 생성 (progress, contributions, mapIndex)
- 서버 시작 시 DB에서 상태 복원 (`OnModuleInit`)
- 상태 변경 시 DB에 저장 (1초 debounce)

### 2. 새로고침 동기화 문제 해결 (#290)
- `game_state` 이벤트 발송/수신 타이밍 점검
- 새로고침 시 프로그레스바/기여도/맵이 즉시 동기화되도록 수정

### 3. 시즌 리셋 스케줄러 (#276)
- 매주 월요일 00:00 KST 자동 리셋
- `season_reset` 이벤트로 전체 클라이언트 동기화

### 4. 맵 이미지 백엔드 서빙 (#219)
- 맵 이미지를 `/api/maps/:index` 엔드포인트로 서빙
- 현재 맵만 접근 허용 (인증 불필요)
- 해금되지 않은 맵 이미지 스포일러 완벽 차단

### 변경 파일
**백엔드:**
- `entities/global-state.entity.ts`: 신규 생성
- `migrations/XXXX-CreateGlobalState.ts`: 신규 생성
- `progress.gateway.ts`: 복원/저장/리셋 로직 + getMapIndex()
- `season-reset.scheduler.ts`: 신규 생성
- `map.controller.ts`: 신규 생성 - 맵 이미지 권한 체크 서빙
- `env.validation.ts`: ASSETS_PATH 환경변수 추가
- `assets/maps/`: 맵 이미지 이동 (frontend → backend)

**프론트엔드:**
- `SocketManager.ts`: season_reset 핸들러 추가
- `MapScene.ts`: 맵 이미지 URL 변경 (`/api/maps/:index`)
- `MapManager.ts`: 맵 이미지 URL 변경

## 💡 체크리스트

- [ ] PR 제목을 형식에 맞게 작성했나요?
- [ ] 브랜치 전략에 맞는 브랜치에 PR을 올리고 있나요?

## 💬 To Reviewers

- 서버 재시작/배포 후에도 프로그레스바와 기여도가 유지됩니다
- 매주 월요일 00:00에 자동으로 시즌이 리셋됩니다
- 해금되지 않은 맵 이미지는 URL 직접 접근해도 403 반환됩니다
```

---

## 관련 문서

| 문서 | 경로 |
|------|------|
| 전체 계획 | `docs/plan/PROGRESS_REFACTOR_PLAN_0127.md` |
| #214 상세 | `docs/plan/ISSUE_214_ROOMSTATE_PERSIST_0127.md` |
| PR1 (선행) | `docs/plan/done/PR1_GLOBAL_PROGRESS_0127.md` |

---

## Open Questions

| 질문 | 현재 가정 | 상태 |
|------|----------|------|
| global_state 레코드 삭제/초기화 허용? | 허용 (onModuleInit에서 자동 생성으로 대응) | ✅ 해결 |
| /api/maps/:index 인증 필요? | 불필요 (현재 맵만 허용, 인증 없이 접근 가능) | ✅ 해결 |

---

## 설계 결정 사항

### 왜 DB인가? (Redis X)

- 현재 인프라에 Redis 없음
- 단일 레코드 업데이트로 오버헤드 적음
- Debounce로 쓰기 빈도 최소화

### 시즌 리셋 시점: 왜 월요일 00:00인가?

- 주말 활동 반영 후 새 주 시작
- 자정은 사용자 활동이 가장 적은 시간대
- KST 기준으로 한국 사용자에게 직관적

### 맵 백엔드 서빙: 왜 완전 차단을 선택했나?

- 구현 복잡도가 낮음 (Controller 하나 추가)
- 펫 실루엣 API와 일관된 보안 정책
- globalState.mapIndex가 메모리에 있어 DB 조회 불필요
- 스포일러 완벽 차단으로 게임 경험 보호
