# PR 1: 프로그레스바/기여도 전체 공유 + 맵 전환 서버 주도

> 2026-01-27 작성

## 브랜치

`feat/#241-global-progress`

## 포함 이슈

| 이슈 | 제목 | 역할 |
|------|------|------|
| [#241](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/241) | 프로그레스바/기여도 전체 방 공유로 변경 | 핵심 작업 |
| [#244](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/244) | github_event → progress_update 이벤트명 변경 | 함께 작업 |
| [#201](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/201) | 프로그레스바 동기화 불일치 | 자동 해결 |

---

## 변경 요약

| 항목 | 현재 | 변경 후 |
|------|------|--------|
| 상태 저장 | `Map<roomId, State>` | 단일 `globalState` |
| progress | 방별 개별 | 전체 공유 |
| contributions | 방별 개별 | 전체 합산 |
| mapIndex | 클라이언트 로컬 관리 | 서버에서 관리, 신규 접속자에게 전달 |
| 실시간 이벤트 | `github_event` | `progress_update` (확장성) |
| 입장 시 이벤트 | `github_state` | `game_state` |
| 이벤트 데이터 | 증분 (pushCount, prCount) | 절대값 (targetProgress, mapIndex) |
| 클라이언트 계산 | `pushCount*2 + prCount*5` | 없음 (서버 값 사용) |
| 브로드캐스트 | `server.to(roomId)` | `server.emit()` |
| 맵 전환 트리거 | 클라이언트 100% 감지 | 서버 100% 감지 → `map_switch` |

---

## 설계 원칙: 절대값 동기화

### 문제 (기존 증분 방식)

```
서버: progress 95% + 10% = 105% → 0%로 리셋 → map_switch emit → github_event emit
클라이언트: map_switch 수신 → 0% | github_event 수신 → addProgress(+10%) = 10% (불일치!)
```

> 기존 `github_event`는 증분(pushCount, prCount)만 전송하여 클라이언트가 직접 계산했음

### 해결 (절대값 방식)

```
서버: progress_update에 targetProgress: 0 포함
클라이언트: setProgress(0) → 항상 서버와 일치
```

- 이벤트 순서에 무관하게 정합성 보장
- 클라이언트에서 점수 계산 불필요
- 네트워크 지연/패킷 유실에도 다음 이벤트로 복구 가능

---

## 수정 파일

### 백엔드

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/progress.gateway.ts` | roomStates → globalState, `progress_update` 이벤트 (절대값), `map_switch` emit |
| `backend/src/github/github.poll-service.ts` | castGithubEventToRoom → castProgressUpdate |
| `backend/src/player/player.gateway.ts` | getRoomState → getGlobalState, `game_state` 이벤트 |

### 프론트엔드

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/game/managers/SocketManager.ts` | `progress_update`/`game_state` 핸들러, `onMapSyncRequired` 콜백 추가, 점수 계산 제거 |
| `frontend/src/game/managers/MapManager.ts` | switchToMap(mapIndex), getCurrentMapIndex() 메서드 추가 |
| `frontend/src/game/ui/createProgressBar.ts` | addProgress → setProgress 중심, onProgressComplete 제거 |
| `frontend/src/game/scenes/MapScene.ts` | `performMapSwitch` 공통 로직, `onMapSwitch`/`onMapSyncRequired` 연결 |

---

## 타입 정의

```typescript
// ===== 변경 전 =====
interface RoomGithubState {
  progress: number;
  contributions: Record<string, number>;
}

interface GithubEventData {
  username: string;
  pushCount: number;
  pullRequestCount: number;
}

// ===== 변경 후 =====

// 서버 내부 상태
interface GlobalGameState {
  progress: number;
  contributions: Record<string, number>;
  mapIndex: number;  // 0-4, 현재 맵 인덱스
}

// progress_update 이벤트 페이로드 (S→C)
interface ProgressUpdateData {
  username: string;
  source: 'github' | 'task' | 'focustime';  // 기여 출처 (확장성)
  targetProgress: number;                    // 현재 progress 절대값
  contributions: Record<string, number>;     // 전체 기여도
  mapIndex: number;                          // 현재 맵 인덱스
}

// game_state 이벤트 페이로드 (S→C, 입장 시)
interface GameStateData {
  progress: number;
  contributions: Record<string, number>;
  mapIndex: number;
}

// 상수 정의
const MAP_COUNT = 5;  // dessert_stage1 ~ dessert_stage5
const PROGRESS_PER_COMMIT = 2;
const PROGRESS_PER_PR = 5;
```

### 운영 전제

> ⚠️ 본 설계는 **단일 서버 인스턴스** 전제입니다.
> `globalState`가 인메모리에 저장되므로, 스케일 아웃 시 Redis 등 공유 저장소가 필요합니다.

### progress 초과분 정책

> progress가 100%를 초과하면 **초과분은 버립니다** (의도된 정책).
> 예: 95% + 10% = 105% → 0%로 리셋 (5% 이월 없음)
> 이유: 맵당 최대 1회 전환을 보장하여 급격한 다중 맵 스킵 방지

---

## 상세 구현

### 1. ProgressGateway 수정

**파일**: `backend/src/github/progress.gateway.ts`

```typescript
// ===== 변경 전 =====
private roomStates = new Map<string, RoomGithubState>();

public castGithubEventToRoom(githubEvent: GithubEventData, roomId: string) {
  this.updateRoomState(roomId, githubEvent);
  this.server.to(roomId).emit('github_event', githubEvent);
}

private updateRoomState(roomId: string, event: GithubEventData) {
  let state = this.roomStates.get(roomId);
  if (!state) {
    state = { progress: 0, contributions: {} };
    this.roomStates.set(roomId, state);
  }
  // ...
}

public getRoomState(roomId: string): RoomGithubState {
  return this.roomStates.get(roomId) || { progress: 0, contributions: {} };
}

// ===== 변경 후 =====
private globalState: GlobalGameState = { progress: 0, contributions: {}, mapIndex: 0 };

public castProgressUpdate(username: string, source: 'github' | 'task' | 'focustime', rawData: any) {
  this.updateGlobalState(username, source, rawData);

  // 절대값 동기화: 서버의 현재 상태를 그대로 전송
  const payload: ProgressUpdateData = {
    username,
    source,
    targetProgress: this.globalState.progress,
    contributions: this.globalState.contributions,
    mapIndex: this.globalState.mapIndex,
  };
  this.server.emit('progress_update', payload);
}

private updateGlobalState(username: string, source: string, rawData: any) {
  // 소스별 progress 계산 (서버에서만 계산)
  let progressIncrement = 0;
  let contributionCount = 0;

  if (source === 'github') {
    progressIncrement = rawData.pushCount * PROGRESS_PER_COMMIT
                      + rawData.pullRequestCount * PROGRESS_PER_PR;
    contributionCount = rawData.pushCount + rawData.pullRequestCount;
  }
  // TODO: task, focustime 소스 추가 시 여기에 계산 로직 추가

  this.globalState.progress += progressIncrement;
  this.globalState.contributions[username] =
    (this.globalState.contributions[username] || 0) + contributionCount;

  // 100% 도달 시 맵 전환
  if (this.globalState.progress >= 100) {
    this.globalState.progress = 0;  // 초과분 버림 (의도된 정책)
    this.globalState.mapIndex = (this.globalState.mapIndex + 1) % MAP_COUNT;
    this.server.emit('map_switch', { mapIndex: this.globalState.mapIndex });
  }
}

public getGlobalState(): GlobalGameState {
  return this.globalState;
}
```

---

### 2. GithubPollService 수정

**파일**: `backend/src/github/github.poll-service.ts`

```typescript
// ===== 변경 전 =====
this.progressGateway.castGithubEventToRoom(result.data!, schedule.roomId);

// ===== 변경 후 =====
this.progressGateway.castProgressUpdate(
  result.data!.username,
  'github',
  result.data!  // { pushCount, pullRequestCount }
);
```

---

### 3. PlayerGateway 수정

**파일**: `backend/src/player/player.gateway.ts`

```typescript
// ===== 변경 전 =====
const roomState = this.progressGateway.getRoomState(roomId);
client.emit('github_state', roomState);

// ===== 변경 후 =====
const globalState = this.progressGateway.getGlobalState();
client.emit('game_state', globalState);  // 이벤트명도 변경
```

---

### 4. SocketManager 수정

**파일**: `frontend/src/game/managers/SocketManager.ts`

```typescript
// ===== 변경 전 =====
socket.on('github_event', (data) => {
  // 클라이언트에서 점수 계산
  const increment = data.pushCount * 2 + data.pullRequestCount * 5;
  this.progressBarController?.addProgress(increment);
});

// ===== 변경 후 =====
// 콜백 프로퍼티
public onMapSwitch?: (mapIndex: number) => void;      // 정상 맵 전환 (100% 도달)
public onMapSyncRequired?: (mapIndex: number) => void; // 동기화 필요 (복구/신규접속)

// progress_update 핸들러 - 절대값 동기화 (점수 계산 없음)
socket.on('progress_update', (data: ProgressUpdateData) => {
  // 서버가 보낸 절대값을 그대로 사용
  this.progressBarController?.setProgress(data.targetProgress);
  this.contributionListController?.updateContributions(data.contributions);

  // mapIndex 동기화: map_switch 유실 시 복구 (MapScene에 위임)
  if (data.mapIndex !== this.mapManager.getCurrentMapIndex()) {
    this.onMapSyncRequired?.(data.mapIndex);
  }
});

// game_state 핸들러 - 입장 시 초기 상태
socket.on('game_state', (data: GameStateData) => {
  this.progressBarController?.setProgress(data.progress);
  this.contributionListController?.updateContributions(data.contributions);

  // 신규/재접속자: 현재 맵으로 동기화 (MapScene에 위임)
  if (data.mapIndex !== this.mapManager.getCurrentMapIndex()) {
    this.onMapSyncRequired?.(data.mapIndex);
  }
});

// map_switch 핸들러 - 정상 맵 전환
socket.on('map_switch', (data: { mapIndex: number }) => {
  this.onMapSwitch?.(data.mapIndex);
});
```

---

### 5. createProgressBar 수정

**파일**: `frontend/src/game/ui/createProgressBar.ts`

```typescript
// ===== 변경 전 =====
const addProgress = (amount: number) => {
  const newProgress = Math.min(progress + amount, 100);
  animateToProgress(newProgress, () => {
    if (progress >= 100) {
      controller.onProgressComplete?.();
    }
  });
};

// ===== 변경 후 =====
// setProgress만 사용 (addProgress 불필요)
const setProgress = (value: number) => {
  const targetProgress = Math.min(Math.max(value, 0), 100);
  animateToProgress(targetProgress);
  // onProgressComplete 제거 - 맵 전환은 서버 map_switch 이벤트로 처리
};

// 인터페이스 변경
interface ProgressBarController {
  setProgress(value: number): void;  // 절대값 설정
  reset(): void;
  getProgress(): number;
  destroy(): void;
  // addProgress, onProgressComplete 제거
}
```

---

### 6. MapScene 수정

**파일**: `frontend/src/game/scenes/MapScene.ts`

```typescript
// ===== 변경 전 =====
this.progressBarController.onProgressComplete = () => {
  this.mapManager.switchToNextMap(() => {
    // 콜백 로직
  });
};

// ===== 변경 후 =====
// 맵 전환 공통 로직
private performMapSwitch(mapIndex: number) {
  this.mapManager.switchToMap(mapIndex, () => {
    this.setupCollisions();
    this.setupUI();
    this.respawnPlayer();
  });
}

// 정상 맵 전환 (progress 100% 도달)
this.socketManager.onMapSwitch = (mapIndex: number) => {
  this.performMapSwitch(mapIndex);
};

// 동기화 맵 전환 (신규접속/재접속/map_switch 유실 복구)
this.socketManager.onMapSyncRequired = (mapIndex: number) => {
  this.performMapSwitch(mapIndex);
};
```

**맵 전환 경로 통일:**

| 케이스 | 트리거 | 경로 |
|--------|--------|------|
| 정상 전환 | `map_switch` | `onMapSwitch` → `performMapSwitch` |
| 신규 접속 | `game_state` | `onMapSyncRequired` → `performMapSwitch` |
| 재접속 | `game_state` | `onMapSyncRequired` → `performMapSwitch` |
| 유실 복구 | `progress_update` | `onMapSyncRequired` → `performMapSwitch` |

### 7. MapManager 수정 (추가)

**파일**: `frontend/src/game/managers/MapManager.ts`

```typescript
// ===== 추가 =====
// 특정 맵으로 직접 이동 (신규 접속자용)
public switchToMap(mapIndex: number, callback?: () => void): void {
  this.currentMapIndex = mapIndex;
  // 기존 switchToNextMap과 동일한 로직으로 맵 전환
  this.performMapSwitch(callback);
}

// 현재 맵 인덱스 조회
public getCurrentMapIndex(): number {
  return this.currentMapIndex;
}
```

---

## 작업 순서

```
1. [ ] 브랜치 생성: feat/#241-global-progress
2. [x] 백엔드 수정
   2.1 [x] 타입 정의 - GlobalGameState, ProgressUpdateData, GameStateData, ProgressSource enum
   2.2 [x] progress.gateway.ts - globalState 구조 (mapIndex 포함)
   2.3 [x] progress.gateway.ts - castProgressUpdate (절대값 전송)
   2.4 [x] progress.gateway.ts - updateGlobalState (점수 계산은 서버에서만)
   2.5 [x] progress.gateway.ts - 100% 감지 시 map_switch emit
   2.6 [x] github.poll-service.ts - castProgressUpdate 호출
   2.7 [x] player.gateway.ts - game_state 이벤트로 변경
3. [x] 프론트엔드 수정
   3.1 [x] SocketManager.ts - connect() 콜백에 onMapSwitch, onMapSyncRequired 추가
   3.2 [x] SocketManager.ts - progress_update 핸들러 (setProgress, onMapSyncRequired)
   3.3 [x] SocketManager.ts - game_state 핸들러 (onMapSyncRequired)
   3.4 [x] SocketManager.ts - map_switch 핸들러 (onMapSwitch)
   3.5 [x] createProgressBar.ts - setProgress 중심으로 변경, addProgress/onProgressComplete 제거
   3.6 [x] MapManager.ts - switchToMap(mapIndex), switchToNextMap 제거
   3.7 [x] MapScene.ts - performMapSwitch 공통 로직 추출
   3.8 [x] MapScene.ts - connect() 콜백에 맵 전환 핸들러 전달
4. [x] 프로그레스바 = 포인트 통합
   4.1 [x] progress.gateway.ts - 신규 생성 (GithubGateway → ProgressGateway 리네이밍)
   4.2 [x] github.poll-service.ts - 모든 GitHub 활동 총합 후 castProgressUpdate 한 번 호출
   4.3 [x] point-settlement.scheduler.ts - addProgress() 호출 추가 (집중시간, 태스크)
   4.4 [x] github.gateway.ts - 삭제 (ProgressGateway로 대체)
   4.5 [x] 관련 모듈/서비스 import 업데이트 (github.module, player.gateway, scheduler.module)
   4.6 [x] 테스트 파일 업데이트 (github.poll-service.spec.ts)
5. [ ] 테스트
6. [ ] PR 생성
7. [ ] 리뷰 & 머지
8. [ ] #201, #244 이슈 Close
```

---

## 4. 프로그레스바 = 포인트 통합 상세

> 모든 활동(GitHub, 집중시간, 투두완료)의 포인트가 프로그레스바에 반영

### 구현 방향

| 항목 | 내용 |
|------|------|
| 리네이밍 | `GithubGateway` → `ProgressGateway` |
| GitHub 활동 | 모든 활동(커밋, PR, 이슈, 리뷰) 총합 후 `castProgressUpdate` 한 번 호출 |
| 자정 정산 | `addPoint()` + `addProgress()` 나란히 호출 (집중시간, 태스크) |
| 상태 관리 | `globalState` 단일 객체로 전역 관리 (roomId 불필요) |
| 미접속 시 | `globalState`는 항상 업데이트, 입장 시 `game_state`로 동기화 |

### 프로그레스 상수

| 활동 | 프로그레스 | 시점 |
|------|-----------|------|
| 커밋 | +2 | 실시간 (GitHub 폴링) |
| PR 생성 | +5 | 실시간 (GitHub 폴링) |
| 이슈 생성 | +3 | 실시간 (GitHub 폴링) |
| PR 리뷰 | +3 | 실시간 (GitHub 폴링) |
| 태스크 완료 | +1 | 자정 정산 |
| 집중시간 30분 | +1 | 자정 정산 |

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `progress.gateway.ts` | 신규 생성 - 프로그레스 전체 관리, `addProgress()` 메서드 추가 |
| `github.gateway.ts` | 삭제 |
| `github.module.ts` | `ProgressGateway` import/export |
| `github.poll-service.ts` | `ProgressGateway` 사용, 모든 GitHub 활동 총합 후 `castProgressUpdate` |
| `player.gateway.ts` | `ProgressGateway` 사용 |
| `scheduler.module.ts` | `GithubModule` import 추가 |
| `point-settlement.scheduler.ts` | `ProgressGateway` 주입, `addProgress()` 호출 추가 |
| `github.poll-service.spec.ts` | `ProgressGateway` mock으로 변경 |

---

## 테스트 체크리스트

### 기능 테스트

- [ ] 방 A에서 GitHub 활동 → 방 B에서도 프로그레스 증가 확인
- [ ] 신규 플레이어 진입 시 현재 `game_state` 수신 확인
- [ ] progress 100% 도달 시 **모든 클라이언트** 동시 맵 전환 확인
- [ ] 맵 전환 후 progress = 0 확인

### 절대값 동기화 검증

- [ ] `progress_update` 이벤트에 `targetProgress` 절대값 포함 확인
- [ ] 클라이언트에서 점수 계산 없이 서버 값 그대로 사용 확인
- [ ] 맵 전환 직후 `progress_update` 수신해도 progress = 0 유지 확인 (이중 반영 없음)

### #201 해결 검증

- [ ] 맵 전환 후 신규 플레이어 진입 시 progress = 0 확인
- [ ] 모든 클라이언트가 동일한 progress 값 유지 확인

### 엣지 케이스

- [ ] 맵 전환 중 신규 플레이어 진입 시 정상 동작 확인
- [ ] 맵 전환 완료 후 신규 접속자가 올바른 맵(mapIndex)에서 시작 확인
- [ ] 재접속 시 map_switch 누락해도 `game_state`의 mapIndex로 현재 맵 동기화 확인
- [ ] 빠른 연속 GitHub 이벤트 시 progress 정확성 확인
- [ ] 이벤트 순서 뒤바뀜 (map_switch ↔ progress_update) 시에도 정합성 유지 확인

---

## PR 본문 템플릿

```markdown
## 🔗 관련 이슈

- close: #241
- close: #244
- close: #201

## ✅ 작업 내용

### 프로그레스바/기여도 전체 공유
- `roomStates` → `globalState`로 변경
- `server.to(roomId)` → `server.emit()` 전체 브로드캐스트

### 절대값 동기화 방식 도입
- 이벤트명 변경: `github_event` → `progress_update`
- 서버가 `targetProgress` (절대값) 전송, 클라이언트는 점수 계산 없이 그대로 사용
- 이벤트 순서에 무관하게 정합성 보장

### 맵 전환 서버 주도
- 서버에서 100% 감지 → `map_switch` 이벤트 전체 브로드캐스트
- 클라이언트 `onProgressComplete` 콜백 제거

### 맵 인덱스 동기화
- 서버 `globalState`에 `mapIndex` 필드 추가
- 신규 접속자는 `game_state`로 현재 맵 인덱스 수신
- 맵 전환 시 `map_switch` 이벤트에 `mapIndex` 포함

### 변경 파일
- `progress.gateway.ts`: globalState, progress_update (절대값), map_switch
- `github.poll-service.ts`: castProgressUpdate
- `player.gateway.ts`: game_state 이벤트
- `SocketManager.ts`: progress_update/game_state 핸들러, onMapSyncRequired 콜백
- `createProgressBar.ts`: setProgress 중심, onProgressComplete 제거
- `MapManager.ts`: switchToMap(mapIndex), getCurrentMapIndex()
- `MapScene.ts`: performMapSwitch 공통 로직, onMapSwitch/onMapSyncRequired 연결

## 💡 체크리스트

- [ ] PR 제목을 형식에 맞게 작성했나요?
- [ ] 브랜치 전략에 맞는 브랜치에 PR을 올리고 있나요?

## 💬 To Reviewers

- 모든 방의 프로그레스바가 동기화되어 함께 진행됩니다
- 100% 도달 시 모든 플레이어가 동시에 맵 전환됩니다
- **절대값 동기화**: 클라이언트에서 점수 계산 없이 서버 값을 그대로 사용하여 정합성 보장
- #201 (프로그레스바 동기화 불일치) 이슈가 이 변경으로 해결됩니다
- #244 (이벤트명 변경) 이슈가 함께 해결됩니다
```

---

## 관련 문서

| 문서 | 경로 |
|------|------|
| 전체 계획 | `docs/plan/PROGRESS_REFACTOR_PLAN_0127.md` |
| #241 상세 | `docs/plan/ISSUE_241_GLOBAL_PROGRESS_0127.md` |
| #201 상세 | `docs/plan/ISSUE_201_PROGRESSBAR_SYNC_0127.md` |
