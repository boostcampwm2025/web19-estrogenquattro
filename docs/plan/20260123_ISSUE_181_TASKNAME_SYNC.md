# Issue #181: 새 플레이어 입장 시 기존 플레이어의 태스크 이름 표시

## 개요

| 항목 | 내용 |
|------|------|
| 이슈 | [#181](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/181) |
| 제목 | 새 플레이어 입장 시 기존 플레이어의 태스크 이름이 표시되지 않음 |
| 우선순위 | HIGH |
| 난이도 | 쉬움 |
| 브랜치 | `fix/#181-players-synced-taskname` |

---

## 구현 현황 (2026-01-23 업데이트)

> **상태: ✅ 구현 완료 (커밋 대기)**

| Step | 파일 | 작업 내용 | 상태 |
|------|------|----------|------|
| 1 | `daily-focus-time.entity.ts` | currentTask relation 추가 | ✅ 완료 |
| 2 | `focustime.service.ts` | startFocusing()에서 currentTask 설정 | ✅ 완료 |
| 3 | `focustime.service.ts` | findOrCreate(), findAllStatuses()에 currentTask relation 로드 | ✅ 완료 |
| 4-1 | `player.gateway.ts` | statusMap 타입에 currentTask 추가 | ✅ 완료 |
| 4-2 | `player.gateway.ts` | players_synced에 taskName 추가 | ✅ 완료 |
| 4-3 | `player.gateway.ts` | player_joined에 taskName 추가 | ✅ 완료 |
| 5 | `SocketManager.ts` | PlayerData 타입에 taskName 추가 | ✅ 완료 |
| 6 | `SocketManager.ts` | addRemotePlayer()에서 taskName 전달 | ✅ 완료 |
| 7 | `socket-manager.spec.ts` | Frontend 테스트 업데이트 | ✅ 완료 |
| 8 | `SOCKET_EVENTS.md` | 문서 업데이트 | ✅ 완료 |

### 남은 작업

- [ ] 변경사항 커밋
- [ ] PR 생성 또는 기존 PR에 포함

---

## 문제 상황

### 재현 방법

1. 플레이어 A가 "코딩하기" 태스크로 집중 시작
2. 플레이어 B가 같은 방에 입장
3. B의 화면에서 A가 **"작업중"으로만 표시됨** ❌
4. 예상: "코딩하기"로 표시 ✅

### 현재 동작 흐름

```
플레이어 B 입장
    ↓
players_synced 이벤트 수신
    ↓
기존 플레이어 A 정보: { status: "FOCUSING", totalFocusSeconds: 120, ... }
    ↓
❌ taskName 필드 없음
    ↓
RemotePlayer.setFocusState(true, { taskName: undefined })
    ↓
"작업중" 태그만 표시 (태스크 이름 없음)
```

### 이벤트별 taskName 포함 여부

| 이벤트 | taskName 포함 | 용도 |
|--------|--------------|------|
| `focused` | ✅ | 집중 시작 시 실시간 전파 |
| `focus_task_updated` | ✅ | 집중 중 태스크 변경 시 |
| `players_synced` | ❌ **누락** | 새 플레이어 입장 시 기존 상태 동기화 |

---

## 원인 분석

### 1. Backend: findAllStatuses()에서 Task 미조회

**파일:** `backend/src/focustime/focustime.service.ts:206-217`

```typescript
async findAllStatuses(playerIds: number[]): Promise<DailyFocusTime[]> {
  // ...
  return this.focusTimeRepository.find({
    where: { /* ... */ },
    relations: ['player'],  // ❌ currentTask 관계 없음
  });
}
```

- `DailyFocusTime.currentTaskId`는 있지만 Task 엔티티를 JOIN하지 않음
- taskName (Task.description)을 가져올 수 없음

### 2. Backend: players_synced에 taskName 미포함

**파일:** `backend/src/player/player.gateway.ts:164-184`

```typescript
return {
  ...p,
  status: status?.status ?? 'RESTING',
  lastFocusStartTime: status?.lastFocusStartTime?.toISOString() ?? null,
  totalFocusSeconds: status?.totalFocusSeconds ?? 0,
  currentSessionSeconds,
  // ❌ taskName 필드 없음!
};
```

### 3. Frontend: PlayerData 인터페이스에 taskName 없음

**파일:** `frontend/src/game/managers/SocketManager.ts:15-30`

```typescript
interface PlayerData {
  // ... 기존 필드들 ...
  status?: FocusStatus;
  totalFocusSeconds?: number;
  currentSessionSeconds?: number;
  // ❌ taskName 필드 없음
}
```

---

## 해결 방안

### 작업 순서

```
1. DailyFocusTime 엔티티 수정
   └─ currentTaskId 유지 + currentTask relation 추가 (로드용)
       ↓
2. startFocusing() 수정
   └─ Task 조회 후 currentTask도 설정
       ↓
3. findAllStatuses(), findOrCreate() 수정
   └─ relations에 currentTask 추가
       ↓
4. player.gateway.ts 수정
   ├─ statusMap 타입에 currentTask 추가
   ├─ players_synced에 taskName 추가
   └─ player_joined에 taskName 추가
       ↓
5. Frontend PlayerData 타입 확장
   └─ taskName 필드 추가
       ↓
6. addRemotePlayer()에서 taskName 전달
   └─ setFocusState() 호출 시 taskName 포함
       ↓
7. 테스트 업데이트
   ├─ Backend E2E: focustime.e2e-spec.ts에 추가
   └─ Frontend: socket-manager.spec.ts 수정
       ↓
8. 문서 업데이트
   └─ SOCKET_EVENTS.md에 taskName 필드 추가
```

---

## 상세 구현

### Step 1: DailyFocusTime 엔티티에 currentTask relation 추가

**파일:** `backend/src/focustime/entites/daily-focus-time.entity.ts`

> **Note:** 디렉토리명이 `entites`임 (오타지만 기존 구조 유지)

**변경 전:**
```typescript
@Column({ name: 'current_task_id', type: 'int', nullable: true })
currentTaskId: number | null;
```

**변경 후:**
```typescript
import { Task } from '../../task/entites/task.entity';

// currentTaskId 컬럼 유지 (읽기 전용 - TypeORM 충돌 방지)
@Column({ name: 'current_task_id', type: 'int', nullable: true, insert: false, update: false })
currentTaskId: number | null;

// currentTask relation (읽기/쓰기 모두 이 relation 사용)
@ManyToOne(() => Task, { nullable: true })
@JoinColumn({ name: 'current_task_id' })
currentTask: Task | null;
```

> **설계 결정:**
> - `currentTaskId`는 `insert: false, update: false`로 **읽기 전용** (TypeORM 충돌 방지)
> - 쓰기는 `currentTask` relation을 통해서만 수행
> - 기존 `currentTaskId` 읽기 로직은 그대로 동작 (DB에서 로드 시 채워짐)
> - 기존 단위 테스트의 `currentTaskId` assert는 **`currentTask?.id`로 변경 필요**

#### 구현 결정 흐름 (개발 시점)

```
1. 기본 방식으로 구현 (insert: false, update: false)
        ↓
2. 검증 전략 실행 (FK 갱신 확인)
        ↓
    ┌───┴───┐
    │       │
FK 갱신됨   FK가 null로 남음
    │       │
    ↓       ↓
3a. 기본   3b. Fallback으로
방식 유지   코드 수정
```

> **Note:** 이 흐름은 **런타임 분기가 아님**. 개발 시점에 "이 방식이 우리 환경에서 작동하는지" 확인하고 코드를 결정하는 것.

#### 검증 전략: FK 영속성 단위 테스트

> **중요:** 임시 디버깅 코드 대신 **영구적인 단위 테스트**로 FK 영속성을 검증합니다.
> 이 테스트가 실패하면 `addFocusTimeToTask()`가 이전 Task에 시간을 누적하지 못하는 regression이 발생합니다.

**파일:** `backend/src/focustime/focustime.service.spec.ts`

```typescript
it('startFocusing()에서 currentTask 설정 시 FK가 실제로 DB에 저장된다', async () => {
  // Given: 플레이어와 Task 생성
  const player = await createTestPlayer();
  const task = await taskRepository.save({
    player,
    description: 'FK 테스트',
    createdDate: new Date().toISOString().slice(0, 10),
  });

  // When: startFocusing() 호출
  await service.startFocusing(player.id, task.id);

  // Then: DB에서 직접 raw query로 FK 확인 (TypeORM 캐시 우회)
  const raw = await dataSource.query(
    'SELECT current_task_id FROM daily_focus_time WHERE player_id = ?',
    [player.id]
  );
  expect(raw[0].current_task_id).toBe(task.id);
});
```

> **Note:** 이 테스트가 실패하면 Fallback 방식으로 전환해야 합니다.

#### ⚠️ Fallback: 기본 방식 실패 시 전환

> **중요:** 아래는 **기본 방식이 실패할 경우에만** 사용하는 대안입니다.
> 검증 전략에서 FK가 갱신되지 않는 것을 확인한 후에만 전환하세요.

**전환 조건 (FK 영속성 단위 테스트 기준):**
- 테스트 결과 `raw[0].current_task_id`가 `null`인 경우
- 또는 TypeORM 버전 호환성 문제가 발생하는 경우

**Fallback 구현:**

```typescript
// Step 1 엔티티 변경: insert: false, update: false 제거
@Column({ name: 'current_task_id', type: 'int', nullable: true })
currentTaskId: number | null;

@ManyToOne(() => Task, { nullable: true })
@JoinColumn({ name: 'current_task_id' })
currentTask: Task | null;
```

```typescript
// Step 2 startFocusing() 변경: 둘 다 설정
focusTime.currentTaskId = verifiedTask?.id ?? null;
focusTime.currentTask = verifiedTask;
```

> **Note:** Fallback 사용 시 Step 2의 in-memory stale 문제는 발생하지 않습니다 (둘 다 설정하므로).

### Step 2: startFocusing()에서 currentTask 설정

**파일:** `backend/src/focustime/focustime.service.ts`

> **중요:** relation을 추가해도 `startFocusing()`에서 `currentTask`를 설정하지 않으면 항상 null입니다.

**변경 전 (라인 77-90):**
```typescript
// taskId 소유권 검증
let verifiedTaskId: number | null = null;
if (taskId) {
  const task = await taskRepo.findOne({
    where: { id: taskId, player: { id: playerId } },
  });
  if (task) {
    verifiedTaskId = taskId;
  } else {
    this.logger.warn(
      `Task ${taskId} not found or not owned by player ${playerId}, ignoring taskId`,
    );
  }
}
// ...
focusTime.currentTaskId = verifiedTaskId;
```

**변경 후:**
```typescript
// taskId 소유권 검증
let verifiedTask: Task | null = null;
if (taskId) {
  const task = await taskRepo.findOne({
    where: { id: taskId, player: { id: playerId } },
  });
  if (task) {
    verifiedTask = task;
  } else {
    this.logger.warn(
      `Task ${taskId} not found or not owned by player ${playerId}, ignoring taskId`,
    );
  }
}
// ...
// currentTaskId는 insert: false, update: false이므로 relation만 설정
focusTime.currentTask = verifiedTask;
```

#### 로그 문 수정 (라인 119-123)

**변경 전:**
```typescript
if (verifiedTaskId) {
  this.logger.log(
    `Player ${playerId} started focusing on task ${verifiedTaskId}`,
  );
}
```

**변경 후:**
```typescript
if (verifiedTask) {
  this.logger.log(
    `Player ${playerId} started focusing on task ${verifiedTask.id}`,
  );
}
```

> **Note:**
> - `currentTaskId` 직접 할당 제거 (insert: false, update: false)
> - `currentTask` relation만 설정하면 TypeORM이 FK 컬럼 자동 관리
> - 기존 `currentTaskId` 읽기 코드는 DB 로드 시 채워지므로 그대로 동작

#### ⚠️ In-memory stale 주의

`focusTime.currentTask = verifiedTask` 설정 후 **메모리 상의 `currentTaskId`는 갱신되지 않습니다**. DB에 save된 후 reload해야 `currentTaskId`가 채워집니다.

**영향 분석:**
- `startFocusing()` 반환 후 바로 `currentTaskId`를 사용하는 코드가 있는지 확인 필요
- 현재 코드베이스에서는 `focused` 이벤트 발송 시 `taskId`를 별도로 전달하므로 문제없음

**만약 stale 문제 발생 시 대안:**
```typescript
// 방법 1: save 후 reload
await this.focusTimeRepository.save(focusTime);
return this.focusTimeRepository.findOne({
  where: { id: focusTime.id },
  relations: ['player', 'currentTask'],
});

// 방법 2: @Column 유지하고 둘 다 설정 (Step 1의 대안 방안 참고)
focusTime.currentTaskId = verifiedTask?.id ?? null;
focusTime.currentTask = verifiedTask;
```

#### startResting()에서 currentTask 처리

기존 코드에서 `currentTaskId`를 유지하던 부분을 확인:
```typescript
// 기존 주석: currentTaskId는 유지 (다음 집중 시작 시 덮어쓰여짐)
```

> **주의:** `currentTask`가 RESTING 상태에서도 유지되면 `players_synced`에서 stale taskName이 반환될 수 있음.
> 하지만 Step 4에서 `status === FOCUSING`일 때만 taskName을 반환하므로 문제없음.

---

### Step 3: findAllStatuses(), findOrCreate() 수정

**파일:** `backend/src/focustime/focustime.service.ts`

#### findAllStatuses()

**변경 전:**
```typescript
async findAllStatuses(playerIds: number[]): Promise<DailyFocusTime[]> {
  if (playerIds.length === 0) return [];

  const today = this.getTodayDateString();
  return this.focusTimeRepository.find({
    where: {
      player: { id: In(playerIds) },
      createdDate: today as unknown as Date,
    },
    relations: ['player'],
  });
}
```

**변경 후:**
```typescript
async findAllStatuses(playerIds: number[]): Promise<DailyFocusTime[]> {
  if (playerIds.length === 0) return [];

  const today = this.getTodayDateString();
  return this.focusTimeRepository.find({
    where: {
      player: { id: In(playerIds) },
      createdDate: today as unknown as Date,
    },
    relations: ['player', 'currentTask'],  // currentTask 관계 추가
  });
}
```

#### findOrCreate()

> **중요:** player_joined에서 `myFocusTime.currentTask`를 사용하므로 findOrCreate()도 currentTask를 로드해야 함

```typescript
async findOrCreate(player: Player): Promise<DailyFocusTime> {
  const today = this.getTodayDateString();
  let focusTime = await this.focusTimeRepository.findOne({
    where: {
      player: { id: player.id },
      createdDate: today as unknown as Date,
    },
    relations: ['player', 'currentTask'],  // currentTask 추가
  });
  // ...
}
```

---

### Step 4: player.gateway.ts 수정 (statusMap, players_synced, player_joined)

**파일:** `backend/src/player/player.gateway.ts`

#### Step 4-1: statusMap 타입에 currentTask 추가

**변경 전 (라인 147-161):**
```typescript
const statusMap = new Map<
  number,
  {
    status: string;
    lastFocusStartTime: Date | null;
    totalFocusSeconds: number;
  }
>();
focusStatuses.forEach((fs) => {
  statusMap.set(fs.player.id, {
    status: fs.status,
    lastFocusStartTime: fs.lastFocusStartTime,
    totalFocusSeconds: fs.totalFocusSeconds,
  });
});
```

**변경 후:**
```typescript
const statusMap = new Map<
  number,
  {
    status: string;
    lastFocusStartTime: Date | null;
    totalFocusSeconds: number;
    currentTask: { description: string } | null;  // 추가
  }
>();
focusStatuses.forEach((fs) => {
  statusMap.set(fs.player.id, {
    status: fs.status,
    lastFocusStartTime: fs.lastFocusStartTime,
    totalFocusSeconds: fs.totalFocusSeconds,
    currentTask: fs.currentTask,  // 추가
  });
});
```

#### Step 4-2: players_synced 데이터에 taskName 추가

**변경 전 (라인 164-184):**
```typescript
const existingPlayers = Array.from(this.players.values())
  .filter((p) => p.socketId !== client.id && p.roomId === roomId)
  .map((p) => {
    const status = statusMap.get(p.playerId);

    const currentSessionSeconds =
      status?.status === FocusStatus.FOCUSING && status?.lastFocusStartTime
        ? Math.floor((Date.now() - status.lastFocusStartTime.getTime()) / 1000)
        : 0;

    return {
      ...p,
      status: status?.status ?? 'RESTING',
      lastFocusStartTime: status?.lastFocusStartTime?.toISOString() ?? null,
      totalFocusSeconds: status?.totalFocusSeconds ?? 0,
      currentSessionSeconds,
    };
  });
```

**변경 후:**
```typescript
const existingPlayers = Array.from(this.players.values())
  .filter((p) => p.socketId !== client.id && p.roomId === roomId)
  .map((p) => {
    const status = statusMap.get(p.playerId);

    const currentSessionSeconds =
      status?.status === FocusStatus.FOCUSING && status?.lastFocusStartTime
        ? Math.floor((Date.now() - status.lastFocusStartTime.getTime()) / 1000)
        : 0;

    return {
      ...p,
      status: status?.status ?? 'RESTING',
      lastFocusStartTime: status?.lastFocusStartTime?.toISOString() ?? null,
      totalFocusSeconds: status?.totalFocusSeconds ?? 0,
      currentSessionSeconds,
      // FOCUSING 상태일 때만 taskName 반환 (RESTING 시 stale 값 방지)
      taskName: status?.status === FocusStatus.FOCUSING
        ? (status?.currentTask?.description ?? null)
        : null,
    };
  });
```

#### Step 4-3: player_joined에도 taskName 추가

> **중요:** 재접속하는 플레이어가 집중 중이면 기존 플레이어들에게 taskName이 보여야 함

**변경 전 (라인 201-212):**
```typescript
// 5. 남들이 볼 내 캐릭터 그리기 (focusTime 정보 포함)
client.to(roomId).emit('player_joined', {
  userId: client.id,
  username: username,
  x: data.x,
  y: data.y,
  status: myFocusTime.status,
  totalFocusSeconds: myFocusTime.totalFocusSeconds,
  currentSessionSeconds: myCurrentSessionSeconds,
  playerId: playerId,
  petImage: petImage,
});
```

**변경 후:**
```typescript
// 5. 남들이 볼 내 캐릭터 그리기 (focusTime 정보 포함)
client.to(roomId).emit('player_joined', {
  userId: client.id,
  username: username,
  x: data.x,
  y: data.y,
  status: myFocusTime.status,
  totalFocusSeconds: myFocusTime.totalFocusSeconds,
  currentSessionSeconds: myCurrentSessionSeconds,
  playerId: playerId,
  petImage: petImage,
  // FOCUSING 상태일 때만 taskName 반환 (RESTING 시 stale 값 방지)
  taskName: myFocusTime.status === FocusStatus.FOCUSING
    ? (myFocusTime.currentTask?.description ?? null)
    : null,
});
```

---

### Step 5: Frontend PlayerData 타입 확장

**파일:** `frontend/src/game/managers/SocketManager.ts`

**변경 전 (라인 15-30):**
```typescript
interface PlayerData {
  userId: string;
  username?: string;
  x: number;
  y: number;
  isMoving?: boolean;
  direction?: Direction;
  timestamp?: number;
  playerId?: number;
  petImage?: string | null;
  status?: FocusStatus;
  lastFocusStartTime?: string | null;
  totalFocusSeconds?: number;
  currentSessionSeconds?: number;
}
```

**변경 후:**
```typescript
interface PlayerData {
  userId: string;
  username?: string;
  x: number;
  y: number;
  isMoving?: boolean;
  direction?: Direction;
  timestamp?: number;
  playerId?: number;
  petImage?: string | null;
  status?: FocusStatus;
  lastFocusStartTime?: string | null;
  totalFocusSeconds?: number;
  currentSessionSeconds?: number;
  taskName?: string | null;  // 추가
}
```

---

### Step 6: addRemotePlayer()에서 taskName 전달

**파일:** `frontend/src/game/managers/SocketManager.ts`

**변경 전 (라인 300-305):**
```typescript
// 입장 시 기존 플레이어의 집중 상태 반영
remotePlayer.setFocusState(data.status === FOCUS_STATUS.FOCUSING, {
  totalFocusSeconds: data.totalFocusSeconds ?? 0,
  currentSessionSeconds: data.currentSessionSeconds ?? 0,
});
```

**변경 후:**
```typescript
// 입장 시 기존 플레이어의 집중 상태 반영
remotePlayer.setFocusState(data.status === FOCUS_STATUS.FOCUSING, {
  totalFocusSeconds: data.totalFocusSeconds ?? 0,
  currentSessionSeconds: data.currentSessionSeconds ?? 0,
  taskName: data.taskName ?? null,  // 추가 (서버와 일관되게 null 사용)
});
```

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/focustime/entites/daily-focus-time.entity.ts` | currentTask relation 추가 (currentTaskId 유지) |
| `backend/src/focustime/focustime.service.ts` | startFocusing()에서 currentTask 설정 + 로그 수정 + findAllStatuses(), findOrCreate()에 relation 로드 |
| `backend/src/focustime/focustime.service.spec.ts` | `currentTaskId` assert를 `currentTask?.id`로 변경 + FK 영속성 테스트 추가 |
| `backend/src/player/player.gateway.ts` | statusMap 타입 확장 + players_synced/player_joined에 taskName 추가 |
| `backend/test/focustime.e2e-spec.ts` | players_synced, player_joined taskName 테스트 추가 (테스트 격리 개선) |
| `frontend/src/game/managers/SocketManager.ts` | PlayerData 타입 확장 + addRemotePlayer() 수정 |
| `frontend/test/integration/socket-manager.spec.ts` | 영향받는 테스트 5개 수정 |
| `docs/api/SOCKET_EVENTS.md` | players_synced, player_joined 이벤트에 taskName 필드 문서화 |
| `docs/features/FOCUS_TIME.md` | players_synced 시퀀스 다이어그램에 taskName 추가 (라인 163) |
| `docs/features/ROOM_JOIN_FLOW.md` | players_synced 페이로드 예시에 taskName 추가 |

---

## 테스트 계획

### 단위 테스트 수정

**파일:** `backend/src/focustime/focustime.service.spec.ts`

#### 기존 테스트 수정 (currentTaskId → currentTask?.id)

`startFocusing()` 테스트에서 `currentTaskId`를 assert하는 **모든 부분**을 수정:

| 라인 | 테스트명 | 변경 전 | 변경 후 |
|-----|---------|--------|--------|
| 197 | `taskId를 전달하면 currentTaskId가 저장된다` | `expect(result.currentTaskId).toBe(task.id)` | `expect(result.currentTask?.id).toBe(task.id)` |
| 210 | `taskId 없이 호출하면 currentTaskId가 null이다` | `expect(result.currentTaskId).toBeNull()` | `expect(result.currentTask).toBeNull()` |
| 261 | `currentTaskId가 없으면 Task 업데이트가 발생하지 않는다` | `expect(result.currentTaskId).toBeNull()` | `expect(result.currentTask).toBeNull()` |

> **Note:** 테스트 설명(it 문자열)에 `currentTaskId`가 포함되어 있지만, **assertion만 변경**하고 테스트 이름은 그대로 유지합니다.
> - 이유: 테스트 이름 변경은 git history 추적에 영향을 줄 수 있음
> - 테스트 이름까지 변경하려면 별도로 결정 (선택사항)

#### 신규 테스트 추가

##### 1. FK 영속성 테스트 (regression 방지용)

> **중요:** 이 테스트가 실패하면 `addFocusTimeToTask()`가 이전 Task에 시간을 누적하지 못합니다.

```typescript
describe('startFocusing', () => {
  it('currentTask 설정 시 FK가 실제로 DB에 저장된다', async () => {
    // Given: 플레이어와 Task 생성
    const player = await createTestPlayer();
    const task = await taskRepository.save({
      player,
      description: 'FK 테스트',
      createdDate: new Date().toISOString().slice(0, 10),
    });

    // When: startFocusing() 호출
    await service.startFocusing(player.id, task.id);

    // Then: DB에서 직접 raw query로 FK 확인 (TypeORM 캐시 우회)
    const raw = await dataSource.query(
      'SELECT current_task_id FROM daily_focus_time WHERE player_id = ?',
      [player.id]
    );
    expect(raw[0].current_task_id).toBe(task.id);
  });
});
```

##### 2. findAllStatuses currentTask 로드 테스트

```typescript
describe('findAllStatuses', () => {
  it('currentTask 관계를 포함하여 반환한다', async () => {
    // Given: 플레이어와 Task가 있는 FocusTime
    const player = await createTestPlayer();
    const task = await taskRepository.save({
      player,
      description: '코딩하기',
      createdDate: new Date().toISOString().slice(0, 10),
    });
    const focusTime = await focusTimeService.startFocusing(player.id, task.id);

    // When: findAllStatuses 호출
    const statuses = await focusTimeService.findAllStatuses([player.id]);

    // Then: currentTask.description 포함
    expect(statuses[0].currentTask).toBeDefined();
    expect(statuses[0].currentTask.description).toBe('코딩하기');
  });
});
```

> **Note:** `taskRepository`와 `dataSource`는 테스트 모듈 설정에서 추가 필요:
> - `Task` 엔티티 추가: `TypeOrmModule.forFeature([DailyFocusTime, Player, Task])`
> - `taskRepository`: `getRepositoryToken(Task)`
> - `dataSource`: `moduleFixture.get<DataSource>(DataSource)`

### E2E 테스트

**파일:** `backend/test/focustime.e2e-spec.ts`

> **Note:** 기존 `focustime.e2e-spec.ts`에 이미 소켓 테스트 하네스(`createSocketClient()`)가 있으므로 여기에 테스트 추가

#### 사전 작업: TypeOrmModule에 Task 엔티티 추가

**기존 focustime.e2e-spec.ts 수정 필요:**
```typescript
// 라인 53-58 수정
TypeOrmModule.forRoot({
  type: 'sqlite',
  database: ':memory:',
  entities: [Player, DailyFocusTime, Task],  // Task 추가
  synchronize: true,
}),
TypeOrmModule.forFeature([Player, DailyFocusTime, Task]),  // Task 추가
```

```typescript
// 상단 import 추가
import { Task } from '../src/task/entites/task.entity';

// beforeAll에서 taskRepository 가져오기
let taskRepository: Repository<Task>;
// ...
taskRepository = moduleFixture.get<Repository<Task>>(getRepositoryToken(Task));
```

#### 테스트 코드

```typescript
// 로컬 타입 정의 (테스트에 필요한 필드만 - 의도적으로 partial)
// 전체 스펙은 docs/api/SOCKET_EVENTS.md의 players_synced 참고
interface SyncedPlayer {
  playerId: number;
  username: string;
  status: string;
  taskName: string | null;
  // userId, x, y 등 다른 필드는 이 테스트에서 미사용
}

describe('players_synced taskName (Bug #181)', () => {
  let clientSocketA: Socket;
  let clientSocketB: Socket;
  let testPlayerB: Player;
  let testTask: Task;
  // testPlayer는 상위 beforeAll에서 생성된 기존 플레이어 사용

  beforeEach(async () => {
    // 테스트 격리: 이전 테스트 잔여 데이터 사전 정리 (테스트 실패 시 afterEach 미실행 대비)
    userStore.delete('67890');
    await playerRepository.delete({ socialId: 67890 });
    await taskRepository.delete({ player: { id: testPlayer.id }, description: '코딩하기' });

    // 두 번째 플레이어 생성
    testPlayerB = await playerRepository.save({
      socialId: 67890,
      nickname: 'testuser2',
    });
    userStore.save({
      githubId: '67890',
      username: 'testuser2',
      avatarUrl: 'https://github.com/testuser2.png',
      accessToken: 'test-access-token-2',
      playerId: testPlayerB.id,
    });

    // Task 생성 (testPlayer 소유 - 상위 beforeAll에서 생성된 플레이어)
    testTask = await taskRepository.save({
      player: testPlayer,
      description: '코딩하기',
      createdDate: new Date().toISOString().slice(0, 10),
    });
  });

  afterEach(async () => {
    clientSocketA?.disconnect();
    clientSocketB?.disconnect();

    // 테스트 격리: 추가한 플레이어/유저 정리
    userStore.delete('67890');
    await playerRepository.delete({ socialId: 67890 });
    await taskRepository.delete({ player: { id: testPlayer.id }, description: '코딩하기' });
  });

  it('기존 집중 중인 플레이어의 taskName이 players_synced에 포함된다', async () => {
    // Given: 플레이어 A 입장 및 Task로 집중 시작
    clientSocketA = await createSocketClient(); // testPlayer용
    await new Promise<void>((resolve) => {
      clientSocketA.once('joined', () => resolve());
      clientSocketA.emit('joining', { x: 100, y: 200, username: 'testuser' });
    });
    // focused 이벤트 ACK 대기 (setTimeout 대신 - CI 안정성)
    await new Promise<void>((resolve) => {
      clientSocketA.once('focused', () => resolve());
      clientSocketA.emit('focusing', { taskId: testTask.id });
    });

    // When: 플레이어 B 입장
    const tokenB = jwtService.sign({
      sub: '67890',
      username: 'testuser2',
      playerId: testPlayerB.id,
    });
    clientSocketB = await createSocketClientWithToken(tokenB);

    const playersSynced = await new Promise<SyncedPlayer[]>((resolve) => {
      clientSocketB.once('players_synced', resolve);
      clientSocketB.emit('joining', { x: 150, y: 250, username: 'testuser2' });
    });

    // Then: A의 taskName이 포함됨
    const playerAData = playersSynced.find((p) => p.playerId === testPlayer.id);
    expect(playerAData).toBeDefined();
    expect(playerAData!.taskName).toBe('코딩하기');
  });

  it('재접속하는 집중 중인 플레이어의 taskName이 player_joined에 포함된다', async () => {
    // Given: 플레이어 A, B 모두 입장
    clientSocketA = await createSocketClient();
    await new Promise<void>((resolve) => {
      clientSocketA.once('joined', () => resolve());
      clientSocketA.emit('joining', { x: 100, y: 200, username: 'testuser' });
    });

    const tokenB = jwtService.sign({
      sub: '67890',
      username: 'testuser2',
      playerId: testPlayerB.id,
    });
    clientSocketB = await createSocketClientWithToken(tokenB);
    await new Promise<void>((resolve) => {
      clientSocketB.once('joined', () => resolve());
      clientSocketB.emit('joining', { x: 150, y: 250, username: 'testuser2' });
    });

    // When: 플레이어 A가 집중 시작 후 재접속 (B가 player_joined 수신)
    await new Promise<void>((resolve) => {
      clientSocketA.once('focused', () => resolve());
      clientSocketA.emit('focusing', { taskId: testTask.id });
    });

    // A 재접속 시뮬레이션: 소켓 재연결
    clientSocketA.disconnect();
    clientSocketA = await createSocketClient();

    const playerJoined = await new Promise<SyncedPlayer>((resolve) => {
      clientSocketB.once('player_joined', resolve);
      clientSocketA.emit('joining', { x: 100, y: 200, username: 'testuser' });
    });

    // Then: 재접속한 A의 taskName이 포함됨
    expect(playerJoined.playerId).toBe(testPlayer.id);
    expect(playerJoined.taskName).toBe('코딩하기');
  });
});
```

#### createSocketClientWithToken 헬퍼 추가

**위치:** `backend/test/focustime.e2e-spec.ts` (기존 `createSocketClient` 함수 아래)

```typescript
// 기존 createSocketClient는 testPlayer용 토큰을 하드코딩
// 다른 플레이어 토큰으로 연결하려면 이 헬퍼 사용
const createSocketClientWithToken = async (token: string): Promise<Socket> => {
  const httpServer = app.getHttpServer() as { address(): { port: number } };
  const address = httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;

  return new Promise((resolve, reject) => {
    const socket = io(url, {
      extraHeaders: {
        cookie: `access_token=${token}`,
      },
      transports: ['websocket'],
      reconnection: false,
    });

    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (error) => reject(error));
    setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
  });
};
```

**대안:** 기존 `createSocketClient`를 수정하여 옵셔널 토큰 파라미터 추가

```typescript
const createSocketClient = async (customToken?: string): Promise<Socket> => {
  const token = customToken ?? jwtService.sign({
    sub: '12345',
    username: 'testuser',
    playerId: testPlayer.id,
  });
  // ... 나머지 동일
};
```

### 프론트엔드 테스트 업데이트

**파일:** `frontend/test/integration/socket-manager.spec.ts`

> **중요:** `setFocusState` 호출을 assert하는 모든 테스트가 영향받습니다.

#### 영향받는 테스트 목록 (5개)

| 라인 | 테스트명 | 수정 내용 |
|------|---------|----------|
| 104-126 | `players_synced로 FOCUSING 상태를 수신하면...` | taskName 추가 |
| 128-151 | `players_synced로 RESTING 상태를 수신하면...` | taskName 추가 (null) |
| 306-329 | `players_synced에서 totalFocusSeconds와 currentSessionSeconds가 전달된다` | taskName 추가 |
| 331-351 | `player_joined로 FOCUSING 상태를 수신하면...` | taskName 추가 |
| 353-373 | `player_joined로 RESTING 상태를 수신하면...` | taskName 추가 (null) |

> **Note:** `focused`, `rested` 이벤트 테스트는 이미 taskName을 처리하므로 변경 불필요

#### 수정 패턴

**players_synced FOCUSING 테스트 (라인 104-126):**
```typescript
it("players_synced로 FOCUSING 상태를 수신하면 해당 플레이어에 집중 상태가 반영된다", () => {
  currentSocket.trigger("players_synced", [
    {
      userId: "remote-1",
      username: "alice",
      x: 0,
      y: 0,
      playerId: 1,
      status: "FOCUSING",
      currentSessionSeconds: 0,
      taskName: "코딩하기",  // 추가
    },
  ]);

  const remote = remotePlayerInstances.get("remote-1");
  expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
    currentSessionSeconds: 0,
    totalFocusSeconds: 0,
    taskName: "코딩하기",  // 추가
  });
});
```

**players_synced RESTING 테스트 (라인 128-151):**
```typescript
it("players_synced로 RESTING 상태를 수신하면 setFocusState(false)가 호출된다", () => {
  currentSocket.trigger("players_synced", [
    {
      userId: "remote-1",
      username: "alice",
      x: 0,
      y: 0,
      playerId: 1,
      status: "RESTING",
      currentSessionSeconds: 0,
      totalFocusSeconds: 30,
      taskName: null,  // 추가 (휴식 중이므로 null)
    },
  ]);

  const remote = remotePlayerInstances.get("remote-1");
  expect(remote?.setFocusState).toHaveBeenCalledWith(false, {
    currentSessionSeconds: 0,
    totalFocusSeconds: 30,
    taskName: null,  // 추가
  });
});
```

**player_joined FOCUSING 테스트 (라인 331-351):**
```typescript
it("player_joined로 FOCUSING 상태를 수신하면 해당 플레이어에 집중 상태가 반영된다", () => {
  currentSocket.trigger("player_joined", {
    userId: "remote-2",
    username: "bob",
    x: 100,
    y: 200,
    status: "FOCUSING",
    totalFocusSeconds: 10,
    currentSessionSeconds: 30,
    taskName: "리뷰하기",  // 추가
  });

  const remote = remotePlayerInstances.get("remote-2");
  expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
    currentSessionSeconds: 30,
    totalFocusSeconds: 10,
    taskName: "리뷰하기",  // 추가
  });
});
```

---

### 수동 테스트

- [ ] 플레이어 A가 "코딩하기" 태스크로 집중 시작
- [ ] 플레이어 B가 같은 방에 입장
- [ ] B의 화면에서 A가 "코딩하기"로 표시되는지 확인
- [ ] A가 태스크를 "리뷰하기"로 변경
- [ ] B의 화면에서 A가 "리뷰하기"로 업데이트되는지 확인
- [ ] 플레이어 C가 입장하여 A가 "리뷰하기"로 표시되는지 확인
- [ ] 플레이어 D가 "테스트하기" 태스크로 집중 중 새로고침 (재접속)
- [ ] 기존 플레이어들 화면에서 D가 "테스트하기"로 표시되는지 확인

---

## 문서 업데이트

### SOCKET_EVENTS.md 업데이트

**파일:** `docs/api/SOCKET_EVENTS.md`

`players_synced`와 `player_joined` 이벤트 스펙에 `taskName` 필드 추가:

```markdown
### players_synced (S→C)

| 필드 | 타입 | 설명 |
|------|------|------|
| ... | ... | ... |
| taskName | string \| null | 현재 집중 중인 태스크 이름 (집중 중이 아니면 null) |

### player_joined (S→C)

| 필드 | 타입 | 설명 |
|------|------|------|
| ... | ... | ... |
| taskName | string \| null | 현재 집중 중인 태스크 이름 (집중 중이 아니면 null) |
```

---

## 관련 문서

- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md) - 소켓 이벤트 스펙
- [FOCUS_TIME.md](../features/FOCUS_TIME.md) - 포커스 타임 기능 문서
- [FOCUS_TIME_DETAIL.md](../features/FOCUS_TIME_DETAIL.md) - 포커스 타임 구현 상세
- [20260122_FOCUSTIME_BUGS_PHASE2.md](./20260122_FOCUSTIME_BUGS_PHASE2.md) - Phase 2 전체 계획
