# 프로그레스바 시스템 리팩토링 전체 계획

> 2026-01-27 작성

## 개요

프로그레스바/기여도 시스템을 **방별 개별 관리**에서 **전체 공유**로 변경하고, 관련 버그를 해결하는 통합 계획

## 관련 이슈

| 이슈 | 제목 | 상태 |
|------|------|------|
| [#241](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/241) | 프로그레스바/기여도 전체 방 공유로 변경 | 핵심 작업 |
| [#201](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/201) | 프로그레스바 동기화 불일치 | #241에서 해결 |
| [#214](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/214) | 서버 재시작 시 프로그레스/기여도 초기화 | #241 이후 작업 |

## 선행 작업

- [x] [PR #238](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/238) 머지 대기

---

## 의존성 다이어그램

```
PR #238 (선행)
    │
    ▼
┌─────────────────────────────────────────┐
│  PR 1: feat/#241-global-progress        │
│  ├─ #241: 전체 공유로 변경               │
│  └─ #201: 동기화 불일치 해결 (자동)       │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  PR 2: fix/#214-global-state-persist    │
│  └─ #214: globalState 영속화            │
└─────────────────────────────────────────┘
```

---

## PR 1: 전체 공유 + 맵 전환 서버 주도

### 브랜치

`feat/#241-global-progress`

### 포함 이슈

- #241: 프로그레스바/기여도 전체 방 공유
- #201: 프로그레스바 동기화 불일치 (자동 해결)

### 변경 요약

| 항목 | 현재 | 변경 후 |
|------|------|--------|
| 상태 저장 | `Map<roomId, State>` | 단일 `globalState` |
| progress | 방별 개별 | 전체 공유 |
| contributions | 방별 개별 | 전체 합산 |
| github_event | `server.to(roomId)` | `server.emit()` |
| 맵 전환 트리거 | 클라이언트 100% 감지 | 서버 100% 감지 → `map_switch` |

### 수정 파일

#### 백엔드

| 파일 | 변경 내용 |
|------|----------|
| `github.gateway.ts` | roomStates → globalState, 100% 감지 시 map_switch emit |
| `github.poll-service.ts` | castGithubEventToRoom → castGithubEvent |
| `player.gateway.ts` | getRoomState → getGlobalState |

#### 프론트엔드

| 파일 | 변경 내용 |
|------|----------|
| `SocketManager.ts` | map_switch 이벤트 핸들러 추가 |
| `createProgressBar.ts` | onProgressComplete 콜백 제거 |
| `MapScene.ts` | 맵 전환 트리거 변경 (콜백 → 소켓 이벤트) |

### 상세 구현

#### 1. GithubGateway 수정

```typescript
// 변경 전
private roomStates = new Map<string, RoomGithubState>();

public castGithubEventToRoom(githubEvent: GithubEventData, roomId: string) {
  this.updateRoomState(roomId, githubEvent);
  this.server.to(roomId).emit('github_event', githubEvent);
}

// 변경 후
private globalState: RoomGithubState = { progress: 0, contributions: {} };

public castGithubEvent(githubEvent: GithubEventData) {
  this.updateGlobalState(githubEvent);
  this.server.emit('github_event', githubEvent);
}

private updateGlobalState(event: GithubEventData) {
  const progressIncrement =
    event.pushCount * PROGRESS_PER_COMMIT +
    event.pullRequestCount * PROGRESS_PER_PR;

  this.globalState.progress += progressIncrement;

  // 100% 도달 시 맵 전환 브로드캐스트
  if (this.globalState.progress >= 100) {
    this.globalState.progress = 0;
    this.server.emit('map_switch');
  }

  const totalCount = event.pushCount + event.pullRequestCount;
  this.globalState.contributions[event.username] =
    (this.globalState.contributions[event.username] || 0) + totalCount;
}

public getGlobalState(): RoomGithubState {
  return this.globalState;
}
```

#### 2. GithubPollService 수정

```typescript
// 변경 전
this.githubGateway.castGithubEventToRoom(result.data!, schedule.roomId);

// 변경 후
this.githubGateway.castGithubEvent(result.data!);
```

#### 3. PlayerGateway 수정

```typescript
// 변경 전
const roomState = this.githubGateway.getRoomState(roomId);
client.emit('github_state', roomState);

// 변경 후
const globalState = this.githubGateway.getGlobalState();
client.emit('github_state', globalState);
```

#### 4. SocketManager 수정

```typescript
// 추가
socket.on('map_switch', () => {
  // MapScene의 맵 전환 메서드 호출
  this.onMapSwitch?.();
});
```

#### 5. createProgressBar 수정

```typescript
// 제거: onProgressComplete 콜백 관련 로직
// 100% 도달해도 클라이언트에서 맵 전환 트리거하지 않음
```

#### 6. MapScene 수정

```typescript
// 변경 전
this.progressBarController.onProgressComplete = () => {
  this.mapManager.switchToNextMap(...);
};

// 변경 후
this.socketManager.onMapSwitch = () => {
  this.mapManager.switchToNextMap(...);
};
```

### 테스트 체크리스트

- [ ] 방 A에서 GitHub 활동 → 방 B에서도 프로그레스 증가 확인
- [ ] 신규 플레이어 진입 시 현재 globalState 수신 확인
- [ ] progress 100% 도달 시 **모든 클라이언트** 동시 맵 전환 확인
- [ ] 맵 전환 후 progress = 0 확인
- [ ] 맵 전환 후 신규 진입 시 progress = 0 확인 (#201 해결 검증)

---

## PR 2: globalState 영속화

### 브랜치

`fix/#214-global-state-persist`

### 포함 이슈

- #214: 서버 재시작 시 프로그레스/기여도 초기화

### 선행 조건

- PR 1 머지 완료

### 변경 요약

서버 재시작 시에도 globalState 유지

### 방향 선택

| 방향 | 장점 | 단점 |
|------|------|------|
| DB 테이블 | 인프라 추가 불필요 | 매 이벤트마다 DB 쓰기 |
| Redis | 빠른 읽기/쓰기, TTL | Redis 인프라 필요 |

**권장**: 현재 인프라에 Redis가 없으면 **DB 테이블** 선택

### DB 방향 구현 (권장)

#### 1. 엔티티 생성

```typescript
// backend/src/database/entities/global-state.entity.ts
@Entity('global_state')
export class GlobalState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 0 })
  progress: number;

  @Column({ type: 'text', default: '{}' })
  contributions: string;  // JSON

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### 2. 마이그레이션

```typescript
// backend/src/database/migrations/XXXX-CreateGlobalState.ts
export class CreateGlobalState implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE global_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        progress INTEGER DEFAULT 0,
        contributions TEXT DEFAULT '{}',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // 초기 레코드 삽입
    await queryRunner.query(`
      INSERT INTO global_state (progress, contributions) VALUES (0, '{}')
    `);
  }
}
```

#### 3. GithubGateway 수정

```typescript
@Injectable()
export class GithubGateway implements OnModuleInit {
  private globalState: RoomGithubState = { progress: 0, contributions: {} };

  constructor(
    @InjectRepository(GlobalState)
    private globalStateRepository: Repository<GlobalState>,
  ) {}

  // 서버 시작 시 DB에서 복원
  async onModuleInit() {
    const saved = await this.globalStateRepository.findOne({ where: { id: 1 } });
    if (saved) {
      this.globalState = {
        progress: saved.progress,
        contributions: JSON.parse(saved.contributions),
      };
    }
  }

  // 상태 변경 시 DB에 저장 (debounce 적용)
  private async persistState() {
    await this.globalStateRepository.update(1, {
      progress: this.globalState.progress,
      contributions: JSON.stringify(this.globalState.contributions),
    });
  }
}
```

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `entities/global-state.entity.ts` | 신규 생성 |
| `migrations/XXXX-CreateGlobalState.ts` | 신규 생성 |
| `github/github.gateway.ts` | onModuleInit 복원, persistState 저장 |
| `github/github.module.ts` | GlobalState 엔티티 import |

### 테스트 체크리스트

- [ ] 서버 재시작 후 progress 유지 확인
- [ ] 서버 재시작 후 contributions 유지 확인
- [ ] DB에 상태 저장 확인

---

## 작업 순서 요약

```
1. PR #238 머지 대기
      │
      ▼
2. 브랜치 생성: feat/#241-global-progress
      │
      ▼
3. PR 1 작업
   ├─ 백엔드: globalState, map_switch
   ├─ 프론트엔드: map_switch 핸들러
   └─ 테스트
      │
      ▼
4. PR 1 리뷰 & 머지
      │
      ▼
5. #201 이슈 Close (PR 1에서 해결)
      │
      ▼
6. 브랜치 생성: fix/#214-global-state-persist
      │
      ▼
7. PR 2 작업
   ├─ 엔티티 & 마이그레이션
   ├─ 복원 & 저장 로직
   └─ 테스트
      │
      ▼
8. PR 2 리뷰 & 머지
      │
      ▼
9. #214 이슈 Close
```

---

## 관련 문서

| 문서 | 경로 |
|------|------|
| #241 상세 | `docs/plan/ISSUE_241_GLOBAL_PROGRESS_0127.md` |
| #201 상세 | `docs/plan/ISSUE_201_PROGRESSBAR_SYNC_0127.md` |
| #214 상세 | `docs/plan/ISSUE_214_ROOMSTATE_PERSIST_0127.md` |

---

## 예상 일정

| 단계 | 작업 |
|------|------|
| Day 1 | PR 1 백엔드 구현 |
| Day 1 | PR 1 프론트엔드 구현 |
| Day 2 | PR 1 테스트 & 리뷰 |
| Day 2 | PR 2 구현 & 테스트 |
| Day 3 | PR 2 리뷰 & 머지 |
