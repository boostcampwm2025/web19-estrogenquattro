# PR 2: globalState 영속화 + 시즌 리셋 + 맵 Lazy Loading

> 2026-01-28 작성

## 브랜치

`fix/#214-global-state-persist`

## 포함 이슈

| 이슈 | 제목 | 역할 |
|------|------|------|
| [#214](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/214) | 서버 재시작 시 프로그레스/기여도 초기화 | 핵심 작업 |
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
| `backend/src/database/data-source.ts` | GlobalState 엔티티 추가 |

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

  @Column({ default: 0 })
  mapIndex: number;

  @UpdateDateColumn()
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
   */
  async onModuleInit() {
    try {
      const saved = await this.globalStateRepository.findOne({
        where: { id: 1 },
      });

      if (saved) {
        this.globalState = {
          progress: saved.progress,
          contributions: JSON.parse(saved.contributions),
          mapIndex: saved.mapIndex,
        };
        this.logger.log(
          `GlobalState restored: progress=${saved.progress}, mapIndex=${saved.mapIndex}`,
        );
      }
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
      await this.globalStateRepository.update(1, {
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
import { Cron, CronExpression } from '@nestjs/schedule';
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
// season_reset 이벤트 핸들러 추가
socket.on('season_reset', (data: { mapIndex: number }) => {
  this.progressBarController?.setProgress(0);
  this.contributionListController?.updateContributions({});
  this.onMapSyncRequired?.(data.mapIndex);
  // TODO: 시즌 리셋 알림 UI 표시 (선택)
});
```

---

## Part 3: 맵 이미지 백엔드 서빙 (#219)

### 목적

- 해금되지 않은 맵 이미지 스포일러 완벽 차단
- 현재 맵 + 다음 맵만 접근 허용

### 방안

**백엔드 서빙 + 권한 체크**: 맵 이미지를 API 엔드포인트로 서빙하고, globalState.mapIndex 기준으로 접근 제어

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/map.controller.ts` | 신규 생성 - 맵 이미지 서빙 |
| `backend/src/github/github.module.ts` | MapController 추가 |
| `backend/src/github/progress.gateway.ts` | getMapIndex() 메서드 추가 |
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
import { Response } from 'express';
import * as path from 'path';
import { ProgressGateway } from './progress.gateway';

@Controller('api/maps')
export class MapController {
  constructor(private readonly progressGateway: ProgressGateway) {}

  /**
   * 맵 이미지 서빙 (권한 체크)
   * 현재 맵 + 다음 맵만 접근 허용
   */
  @Get(':index')
  getMap(
    @Param('index', ParseIntPipe) index: number,
    @Res() res: Response,
  ) {
    const currentMapIndex = this.progressGateway.getMapIndex();

    // 현재 맵 + 다음 맵만 허용 (순환 고려)
    const nextMapIndex = (currentMapIndex + 1) % 5;
    if (index !== currentMapIndex && index !== nextMapIndex) {
      throw new ForbiddenException('Map not unlocked yet');
    }

    const stageNum = index + 1;
    const filePath = path.join(
      __dirname,
      `../../assets/maps/desert_stage${stageNum}.webp`,
    );

    res.sendFile(filePath);
  }
}
```

#### 3.2 ProgressGateway에 getter 추가

**파일**: `backend/src/github/progress.gateway.ts`

```typescript
/**
 * 현재 맵 인덱스 반환 (MapController에서 사용)
 */
public getMapIndex(): number {
  return this.globalState.mapIndex;
}
```

#### 3.3 GithubModule 수정

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

#### 3.4 맵 이미지 이동

```bash
# frontend/public/assets/maps/ → backend/assets/maps/
mkdir -p backend/assets/maps
mv frontend/public/assets/maps/desert_stage*.webp backend/assets/maps/
```

#### 3.5 프론트엔드 URL 변경

**파일**: `frontend/src/game/scenes/MapScene.ts`

```typescript
// 변경 전
this.load.image(`map_stage${i}`, `/assets/maps/desert_stage${i}.webp`);

// 변경 후
this.load.image(`map_stage${i}`, `/api/maps/${i - 1}`);
```

**파일**: `frontend/src/game/managers/MapManager.ts`

```typescript
// 변경 전
this.scene.load.image(mapKey, `/assets/maps/desert_stage${stageNum}.webp`);

// 변경 후
this.scene.load.image(mapKey, `/api/maps/${index}`);
```

---

## 작업 순서

```
1. [ ] 브랜치 생성: fix/#214-global-state-persist

=== Part 1: globalState 영속화 (#214) ===
2. [ ] 엔티티 생성
   2.1 [ ] global-state.entity.ts 생성
   2.2 [ ] data-source.ts에 엔티티 추가
3. [ ] 마이그레이션 생성 및 실행
   3.1 [ ] 마이그레이션 파일 생성
   3.2 [ ] pnpm migration:run
4. [ ] ProgressGateway 수정
   4.1 [ ] constructor에 Repository 주입
   4.2 [ ] OnModuleInit 구현 (복원 로직)
   4.3 [ ] schedulePersist, persistState 구현
   4.4 [ ] resetSeason 메서드 추가
   4.5 [ ] castProgressUpdate에 schedulePersist 추가
   4.6 [ ] addProgress에 schedulePersist 추가
5. [ ] GithubModule 수정
   5.1 [ ] TypeOrmModule.forFeature에 GlobalState 추가

=== Part 2: 시즌 리셋 (#276) ===
6. [ ] SeasonResetScheduler 생성
   6.1 [ ] season-reset.scheduler.ts 생성
   6.2 [ ] Cron 데코레이터 설정 (매주 월요일 00:00 KST)
7. [ ] SchedulerModule 수정
   7.1 [ ] GithubModule import 추가
   7.2 [ ] SeasonResetScheduler provider 추가
8. [ ] 클라이언트 season_reset 핸들러 추가

=== Part 3: 맵 이미지 백엔드 서빙 (#219) ===
9. [ ] 맵 이미지 이동
   9.1 [ ] frontend/public/assets/maps/ → backend/assets/maps/
10. [ ] MapController 생성
    10.1 [ ] map.controller.ts 생성
    10.2 [ ] getMap() 엔드포인트 구현 (권한 체크)
11. [ ] ProgressGateway 수정
    11.1 [ ] getMapIndex() 메서드 추가
12. [ ] GithubModule 수정
    12.1 [ ] MapController 추가
13. [ ] 프론트엔드 URL 변경
    13.1 [ ] MapScene.ts - 이미지 URL 변경
    13.2 [ ] MapManager.ts - 이미지 URL 변경

=== 마무리 ===
14. [ ] 테스트
15. [ ] PR 생성
16. [ ] 리뷰 & 머지
17. [ ] #214, #219, #276 이슈 Close
```

---

## 테스트 체크리스트

### Part 1: 영속화 테스트

- [ ] 서버 시작 시 DB에서 상태 복원 확인 (로그 확인)
- [ ] GitHub 활동 후 DB에 상태 저장 확인
- [ ] 서버 재시작 후 progress 유지 확인
- [ ] 서버 재시작 후 contributions 유지 확인
- [ ] 서버 재시작 후 mapIndex 유지 확인

### Part 2: 시즌 리셋 테스트

- [ ] 스케줄러 동작 확인 (로그 또는 수동 트리거)
- [ ] 리셋 후 progress=0, contributions={}, mapIndex=0 확인
- [ ] 클라이언트에서 season_reset 이벤트 수신 확인
- [ ] 모든 클라이언트 맵 동기화 확인

### Part 3: 백엔드 맵 서빙 테스트

- [ ] `/api/maps/0` 접근 시 현재 맵 이미지 반환 확인
- [ ] `/api/maps/{currentMapIndex + 1}` 접근 시 다음 맵 이미지 반환 확인
- [ ] `/api/maps/{currentMapIndex + 2}` 접근 시 403 Forbidden 확인
- [ ] 기존 `/assets/maps/desert_stage*.webp` URL 접근 시 404 확인
- [ ] 게임 내 맵 이미지 정상 표시 확인
- [ ] 맵 전환 시 끊김 없이 동작하는지 확인

### 통합 테스트

- [ ] 시즌 리셋 후 서버 재시작해도 리셋 상태 유지 확인
- [ ] 시즌 리셋 후 맵 0부터 정상 로드 확인

---

## PR 본문 템플릿

```markdown
## 🔗 관련 이슈

- close: #214
- close: #219
- close: #276

## ✅ 작업 내용

### 1. globalState 영속화 (#214)
- `global_state` 테이블 생성 (progress, contributions, mapIndex)
- 서버 시작 시 DB에서 상태 복원 (`OnModuleInit`)
- 상태 변경 시 DB에 저장 (1초 debounce)

### 2. 시즌 리셋 스케줄러 (#276)
- 매주 월요일 00:00 KST 자동 리셋
- `season_reset` 이벤트로 전체 클라이언트 동기화

### 3. 맵 이미지 백엔드 서빙 (#219)
- 맵 이미지를 `/api/maps/:index` 엔드포인트로 서빙
- 현재 맵 + 다음 맵만 접근 허용 (권한 체크)
- 해금되지 않은 맵 이미지 스포일러 완벽 차단

### 변경 파일
**백엔드:**
- `entities/global-state.entity.ts`: 신규 생성
- `migrations/XXXX-CreateGlobalState.ts`: 신규 생성
- `progress.gateway.ts`: 복원/저장/리셋 로직 + getMapIndex()
- `season-reset.scheduler.ts`: 신규 생성
- `map.controller.ts`: 신규 생성 - 맵 이미지 권한 체크 서빙
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
