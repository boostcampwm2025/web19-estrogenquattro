# Issue #362, #364, #369: FocusTime 상태 정리

## 관련 이슈

- #362: 전날에서 넘어온 태스크 삭제 시 FOREIGN KEY 에러
- #364: 집중 중인 태스크 삭제 시 안내 문구 개선 (프론트엔드)
- #369: 자정 스케줄러에서 미접속 유저의 집중 상태 RESTING으로 변경
- ~~#370: 소켓 disconnect 시 집중 시간 미정산~~ → **이미 구현됨** (FocusTimeGateway)

---

## 설계 가정

### 싱글 인스턴스 배포

이 계획은 **싱글 인스턴스 배포**를 가정합니다.

- `ecosystem.config.js`에서 `instances: 1`로 설정됨
- 스케줄러가 `PlayerGateway`의 in-memory 연결 상태를 직접 참조
- 멀티 인스턴스 환경에서는 Redis 등 공유 저장소가 필요함

### KST 타임존 기준

모든 날짜 경계 처리는 **KST (Asia/Seoul)**를 기준으로 합니다.

- 스케줄러 cron: `@Cron('0 0 0 * * *', { timeZone: 'Asia/Seoul' })`
- `getYesterdayKstRange()`: KST 하루를 UTC 범위로 반환
- `new Date()`: 스케줄러 실행 시점(KST 00:00 = UTC 전날 15:00)에 호출되어 정확한 KST 날짜 경계에 맞음

### 연속 집중 세션 유지

자정을 넘겨 집중하는 경우, **연속 세션을 하나로 유지**합니다.

```
어제 23:00 ~ 오늘 01:00 연속 집중
→ 총 2시간을 "오늘" 레코드에 적립
```

- 접속 중인 유저의 `lastFocusStartTime`은 어제 값을 그대로 유지
- 자정 이전 집중 시간이 손실되지 않도록 의도된 설계
- #357 문서의 "자정으로 리셋" 방안과 다른 접근 (연속 세션 우선)

### 미접속 유저의 집중 시간 누락 허용

disconnect 정산이 실패한 상태에서 자정 스케줄러가 실행되면, **미접속 유저의 "마지막 집중 시작 ~ 자정" 구간 시간이 누락**될 수 있습니다.

```
시나리오:
1. 23:00에 집중 시작
2. 23:30에 브라우저 강제 종료 (disconnect 정산 실패)
3. 00:00 스케줄러 실행 → 미접속으로 판단 → lastFocusStartTime=null
4. 결과: 23:00~00:00 집중 시간(1시간) 누락
```

**이 데이터 손실을 명시적으로 허용합니다:**

- 자정 시점 정산 로직 추가 시 복잡도 증가 및 서버 부담
- disconnect 정산이 정상 동작하면 발생하지 않는 edge case
- 기본 원칙: 데이터 과다 적립보다 누락이 안전
- **예외:** stale 연결로 인한 과다 적립 가능성은 연속 세션 보장을 위해 허용 (아래 "PlayerGateway.players 맵의 한계" 참조)

### PlayerGateway.players 맵의 한계

접속 여부 판별이 `PlayerGateway`의 `players` 맵에 의존합니다.

**Edge case:**

| 상황 | 스케줄러 판단 | 실제 상태 | 결과 |
|------|-------------|----------|------|
| 정상 접속 | 접속 중 | 접속 중 | ✅ 정상 |
| TCP keepalive 지연 | 접속 중 | 미접속 | ⚠️ FOCUSING 유지 |
| Stale entry | 접속 중 | 미접속 | ⚠️ FOCUSING 유지 |

- 네트워크 끊김 시 TCP 타임아웃 전까지 맵에 남아있을 수 있음
- "접속 중"으로 잘못 판단 시 FOCUSING 상태와 lastFocusStartTime이 복사됨
- 재접속 시 `startResting()` 호출 → **과다 적립 가능성** (어제 시작 시간 기준 계산)
- 재접속하지 않으면 계산이 발생하지 않아 실제 과다 적립은 없음
- 연속 세션 보장을 위해 이 방향(과다 적립 가능성)을 허용

### 서버 재시작 시 데이터 손실 허용

자정 직전에 서버가 재시작되면, **모든 유저가 미접속으로 판단**될 수 있습니다.

```
시나리오:
1. 23:00 유저 A 집중 시작
2. 23:59:50 서버 크래시/재시작
3. 23:59:55 서버 복구 (gateway.players = {} 비어있음)
4. 00:00:00 스케줄러 실행
   - 유저 A: 재연결 전 → 미접속으로 판단
   - 오늘 레코드: { status: RESTING, lastFocusStartTime: null }
5. 결과: 유저 A의 23:00~00:00 집중 시간(1시간) 누락
```

**이 데이터 손실을 명시적으로 허용합니다:**

- 자정 직전 서버 재시작은 매우 드문 edge case
- 복잡한 safeguard 로직 추가 대비 비용 효율이 낮음
- 재접속 시 새 레코드가 정상 생성되어 이후 사용에 지장 없음

---

## 버그 재현 (2026-01-31)

### #362 재현

1. Task 생성 → 집중 시작
2. **휴식하지 않고** 스케줄러 실행 대기
3. 스케줄러 실행 → 새 레코드 생성
4. Task 삭제 시도 → FK 에러 발생

```
SQLITE_CONSTRAINT: FOREIGN KEY constraint failed
DELETE FROM "tasks" WHERE "id" = 2
```

### #369 재현 (2026-01-31)

**재현 순서:**
1. Task 생성 → 집중 시작
2. 브라우저 닫기 (미접속 상태)
3. 스케줄러 실행 (22:00)
4. 다시 접속 (22:02)

**재현 로그:**
```
[FocusTimeMidnightScheduler] Successfully created 4 new focustime records for today
[PlayerGateway] Client connected: FYsm0BS0gfgSjCzBAAAD (user: honki12345)
[FocusTimeService] [TX START] startResting - playerId: 1
[FocusTimeService] Added 494s to task 4  ← 잘못된 집중 시간 추가!
[FocusTimeGateway] User honki12345 started resting in room room-1
```

**문제점:**
- 미접속 상태였는데 `status=FOCUSING`으로 복사됨
- 재접속 시 자동으로 `startResting` 호출
- 실제 집중하지 않은 494초가 Task에 추가됨 (버그)

### ~~#370 재현~~ → 이미 수정됨

> FocusTimeGateway.handleDisconnect에서 startResting() 호출로 정상 동작 중

---

## 문제 분석

### #362 원인

자정 스케줄러가 어제 레코드를 복사할 때 **어제 레코드의 `current_task_id`를 해제하지 않음**

```
스케줄러 실행 후:
  어제 레코드: current_task_id = 116  ← 그대로 (문제!)
  오늘 레코드: current_task_id = 116  ← 복사됨

오늘 휴식 후:
  어제 레코드: current_task_id = 116  ← 여전히 참조!
  오늘 레코드: current_task_id = null

Task 삭제 시도 → 어제 레코드가 참조 → FK constraint failed
```

### #369 원인

자정 스케줄러가 **접속 여부를 구분하지 않고** 모든 어제 레코드의 status를 그대로 복사

```
미접속 유저:
  어제 레코드: status=FOCUSING (브라우저 닫고 감)
  오늘 레코드: status=FOCUSING (그대로 복사됨 - 버그!)

기대 동작:
  오늘 레코드: status=RESTING (미접속이므로)
```

### ~~#370 원인~~ → 이미 구현됨

**FocusTimeGateway에 이미 disconnect 정산 로직이 있음:**

```typescript
// backend/src/focustime/focustime.gateway.ts (176-194라인)
async handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
  const user = client.data.user;
  if (!user) return;

  try {
    await this.focusTimeService.startResting(user.playerId);  // ← 이미 구현됨!
    this.logger.log(`User ${user.username} disconnected. Setting status to RESTING.`);
  } catch (error) {
    // ...
  }
}
```

**NestJS WebSocket은 두 Gateway 모두의 handleDisconnect를 호출:**
| Gateway | handleDisconnect 동작 |
|---------|----------------------|
| `PlayerGateway` | room 정리, GitHub 폴링 중지 |
| `FocusTimeGateway` | **startResting() 호출** ← 이미 있음! |

→ **추가 구현 불필요**

---

## 핵심 설계: Task 삭제 보호 (daily_focus_time 활용)

### 왜 메모리 캐시가 아닌 DB를 사용하는가?

| 방식 | 장점 | 단점 |
|------|------|------|
| 메모리 캐시 | 빠른 조회 | **서버 재시작 시 데이터 유실** |
| DB 조회 | 영속성 보장 | 약간의 조회 비용 |

→ **서버 재시작해도 "집중 중인 Task" 상태가 유지**되어야 하므로 DB 사용

### 기존 테이블 활용: daily_focus_time.currentTaskId

새 컬럼 추가 없이 기존 `daily_focus_time` 테이블의 컬럼 조합으로 해결:

```
┌─────────────────────────────────────────────────────┐
│                  daily_focus_time                   │
├─────────────────────────────────────────────────────┤
│ player_id: 1                                        │
│ status: FOCUSING        ← 집중 중 여부              │
│ current_task_id: 42     ← 현재 집중 Task            │
│ ...                                                 │
└─────────────────────────────────────────────────────┘

쿼리: WHERE status = 'FOCUSING' AND current_task_id = ?
```

### 삭제 검증 로직

```typescript
// 해당 Task로 집중 중인 레코드가 있으면 삭제 차단
const focusingRecord = await this.focusTimeRepository.findOne({
  where: {
    player: { id: playerId },
    status: FocusStatus.FOCUSING,
    currentTaskId: taskId,
  },
});

if (focusingRecord) {
  throw new TaskFocusingException();  // 400 + TASK_FOCUSING 코드
}
```

**핵심 포인트:** 날짜 조건(`createdAt`) 없이 조회!

### 에러 응답 요약

| 예외 | 에러 코드 | HTTP 상태 | 메시지 |
|------|----------|----------|--------|
| `TaskNotFoundException` | `TASK_NOT_FOUND` | 404 | 태스크를 찾을 수 없습니다. |
| `TaskNotOwnedException` | `TASK_NOT_OWNED` | 403 | 본인의 태스크만 삭제할 수 있습니다. |
| `TaskFocusingException` | `TASK_FOCUSING` | 400 | 집중 중인 태스크는 삭제할 수 없습니다. |

### 시나리오별 동작

#### 시나리오 1: 집중 중인 Task 삭제 시도

```
상태:
  daily_focus_time: { status: FOCUSING, currentTaskId: 42 }

요청: DELETE /api/tasks/42

쿼리: findOne({ status: FOCUSING, currentTaskId: 42 })
결과: 레코드 발견 → TaskFocusingException (400, TASK_FOCUSING)
```

#### 시나리오 2: 휴식 중 삭제

```
상태:
  daily_focus_time: { status: RESTING, currentTaskId: null }

요청: DELETE /api/tasks/42

쿼리: findOne({ status: FOCUSING, currentTaskId: 42 })
결과: null (status가 RESTING) → 삭제 허용
```

#### 시나리오 3: 다른 Task 삭제

```
상태:
  daily_focus_time: { status: FOCUSING, currentTaskId: 42 }  ← Task 42 집중 중

요청: DELETE /api/tasks/99  ← Task 99 삭제 시도

쿼리: findOne({ status: FOCUSING, currentTaskId: 99 })
결과: null (currentTaskId가 42) → 삭제 허용
```

#### 시나리오 4: 자정 넘김 (어제 시작한 집중)

```
상태 (1/30 00:30):
  어제 레코드 (1/29): { status: FOCUSING, currentTaskId: 42 }  ← 여전히 참조 중!
  오늘 레코드 (1/30): 아직 생성 안 됨 또는 스케줄러로 생성됨

요청: DELETE /api/tasks/42

쿼리: findOne({ status: FOCUSING, currentTaskId: 42 })
       ↑ 날짜 조건 없음! 어제 레코드도 검색됨
결과: 어제 레코드 발견 → TaskFocusingException (400, TASK_FOCUSING)
```

**핵심:** 날짜를 조건에 넣지 않으므로, 자정을 넘겨도 **어제 레코드**에서 집중 상태를 감지합니다.

### 이전 방식과 비교

| 항목 | 메모리 캐시 방식 | DB 조회 방식 (채택) |
|------|-----------------|-------------------|
| 서버 재시작 | ❌ 상태 유실 | ✅ 상태 유지 |
| 자정 넘김 | 별도 처리 필요 | ✅ 날짜 무관 조회 |
| 추가 컬럼 | 필요할 수 있음 | ✅ 기존 컬럼 활용 |
| 동기화 | 소켓 이벤트마다 갱신 | ✅ 자동 (DB 단일 소스) |

### 휴식 시 currentTaskId는 null이 됨

`startResting()` 호출 시 `currentTaskId`가 **null로 초기화**됩니다:

```typescript
// focustime.service.ts:199-201
focusTime.status = FocusStatus.RESTING;
focusTime.currentTaskId = null;   // ← null로 설정!
focusTime.currentTask = null;
```

따라서 **휴식 중이면 삭제 가능**합니다:

| 상태 | status | currentTaskId | 삭제 가능? |
|------|--------|---------------|-----------|
| 집중 중 | FOCUSING | 42 | ❌ 차단 |
| 휴식 중 | RESTING | null | ✅ 허용 |

### 스케줄러 실패 시나리오

#### 정상 케이스 (disconnect 정상 동작)

```
1. 집중 시작 → status=FOCUSING, currentTaskId=42
2. 브라우저 닫기 → disconnect → startResting() 호출
3. 결과: status=RESTING, currentTaskId=null
4. 스케줄러 실패해도 문제없음 (이미 RESTING)
5. Task 42 삭제 → ✅ 허용
```

#### 문제 케이스 (disconnect + 스케줄러 둘 다 실패)

```
1. 집중 시작 → status=FOCUSING, currentTaskId=42
2. 브라우저 닫기 + disconnect 정산 실패 (네트워크 문제)
3. 어제 레코드: status=FOCUSING, currentTaskId=42 (정리 안 됨!)
4. 스케줄러도 실패
5. Task 42 삭제 시도
6. 조회: findOne({ FOCUSING, 42 }) → 어제 레코드 발견
7. ❌ 삭제 차단 (False Positive)
```

#### 이건 괜찮은가? → Fail-safe

| 실패 방향 | 결과 | 심각도 |
|----------|------|--------|
| 삭제 가능한데 차단 | 사용자 불편 | **낮음** (재접속하면 해결) |
| 삭제 불가한데 허용 | 데이터 손실 | **높음** |

→ **안전한 방향으로 실패**합니다. 재접속 시 `startResting()`이 호출되어 정리됩니다.

### 스케줄러 트랜잭션 실패 시

#### 트랜잭션 구조

```typescript
await this.dataSource.transaction(async (manager) => {
  const newRecords = [];

  for (const record of yesterdayRecords) {
    // 1. 오늘 레코드 준비
    newRecords.push(this.focusTimeRepository.create({ ... }));

    // 2. 어제 레코드 FK 해제 (status는 변경 안 함)
    record.currentTaskId = null;
  }

  // 3. 오늘 레코드 + 어제 레코드 한 번에 저장
  await manager.save([...newRecords, ...yesterdayRecords]);
});
```

#### 원자성(Atomicity): 둘 다 성공하거나 둘 다 실패

| 실패 지점 | 결과 |
|----------|------|
| 1번에서 실패 | 전체 롤백 → 어제 레코드 그대로 |
| 2번에서 실패 | 전체 롤백 → 오늘 레코드도 생성 안 됨 |

#### 트랜잭션 실패 후 시나리오

```
1. 어제 집중 (FOCUSING, currentTaskId=42)
2. 스케줄러 트랜잭션 실패 (전체 롤백)
3. 상태:
   - 어제 레코드: FOCUSING, currentTaskId=42 (그대로!)
   - 오늘 레코드: 없음

4. 오늘 접속 → joining → findOrCreate → 오늘 레코드 생성
5. Task 42 삭제 시도
6. TaskService 조회: findOne({ FOCUSING, 42 }) → 어제 레코드 발견!
7. ❌ 삭제 차단 (Fail-safe)
```

#### 트랜잭션이 필요한 이유

트랜잭션 없이 순차 실행하면 **부분 실패** 위험:

```
1. 오늘 레코드 생성 ✅
2. 어제 레코드 정리 실패 ❌

결과:
- 오늘 레코드: currentTaskId=42
- 어제 레코드: currentTaskId=42 (정리 안 됨)
- Task 42가 두 레코드에서 참조됨! (위험)
```

#### 결론

| 상황 | 결과 | FK 에러? |
|------|------|----------|
| 트랜잭션 성공 | 어제 정리됨 | ❌ 없음 |
| 트랜잭션 실패 | 어제 그대로 + 오늘 없음 | ❌ TaskService 차단 |
| 트랜잭션 없이 부분 실패 | 둘 다 참조 | ⚠️ 위험 |

**트랜잭션 덕분에 부분 실패가 방지되고, 전체 실패 시에도 TaskService가 차단하므로 안전합니다.**

---

## 해결 방안

### 스케줄러 수정 (#362, #369)

1. **접속 중인 유저**: status 유지, currentTaskId 복사, lastFocusStartTime 복사 (연속 세션)
2. **미접속 유저**: status=RESTING, currentTaskId=null, lastFocusStartTime=null (#369)
3. **어제 레코드**: currentTaskId=null (FK 해제, status는 변경 안 함) (#362)

### ~~PlayerGateway 수정 (#370)~~ → 불필요

~~1. **handleDisconnect에서 집중 중이면 정산**: `startResting()` 호출~~

→ **FocusTimeGateway.handleDisconnect에서 이미 처리 중**

### TaskService 수정 (#362, #364)

1. **집중 중이면 삭제 차단**: 에러 코드 기반 비즈니스 에러 반환

### 에러 코드 기반 메시지 구조 (#364)

다국어 지원을 위해 에러 코드 기반 구조를 도입합니다.

**백엔드:** 에러 코드를 포함한 응답 반환
**프론트엔드:** 에러 코드 기반 메시지 매핑

---

## 상세 구현

### 1. PlayerGateway 수정 (#369 - 스케줄러용)

**PlayerGateway** (`backend/src/player/player.gateway.ts`)

> **Note:** handleDisconnect 정산은 FocusTimeGateway에서 이미 처리 중이므로 수정 불필요.
> 스케줄러에서 접속 상태 확인을 위한 메서드만 추가.

```typescript
// 접속 중인 플레이어 ID Set 반환 (스케줄러용, O(1) 조회)
getConnectedPlayerIds(): Set<number> {
  const playerIds = new Set<number>();
  for (const player of this.players.values()) {
    if (player.playerId) {
      playerIds.add(player.playerId);
    }
  }
  return playerIds;
}
```

### 2. PlayerModule 수정

**PlayerModule** (`backend/src/player/player.module.ts`)

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Player]),
    // ...
  ],
  providers: [PlayerService, PlayerGateway],
  exports: [TypeOrmModule, PlayerService, PlayerGateway],  // PlayerGateway export 추가
})
```

### 3. 스케줄러 수정 (#362, #369)

**FocusTimeMidnightScheduler** (`backend/src/scheduler/focustime-midnight.scheduler.ts`)

```typescript
constructor(
  @InjectRepository(DailyFocusTime)
  private readonly focusTimeRepository: Repository<DailyFocusTime>,
  private readonly dataSource: DataSource,
  private readonly playerGateway: PlayerGateway,  // 추가: 접속 상태 확인용
) {}

async handleMidnight(): Promise<void> {
  this.logger.log('Midnight scheduler started - copying focustime records');

  const { start, end } = getYesterdayKstRange();
  const now = new Date();

  const yesterdayRecords = await this.focusTimeRepository.find({
    where: { createdAt: Between(start, end) },
    relations: ['player'],
  });

  if (yesterdayRecords.length === 0) {
    return;
  }

  // 접속 중인 플레이어 ID Set 조회 (O(1) 조회용)
  const connectedPlayerIds = this.playerGateway.getConnectedPlayerIds();

  // 트랜잭션으로 원자성 보장
  await this.dataSource.transaction(async (manager) => {
    const newRecords = [];

    for (const record of yesterdayRecords) {
      const isConnected = connectedPlayerIds.has(record.player.id);

      // 1. 오늘 레코드 준비
      newRecords.push(this.focusTimeRepository.create({
        player: record.player,
        totalFocusSeconds: 0,
        createdAt: now,
        // 접속 중: 상태 유지 (연속 세션), 미접속: RESTING (#369)
        status: isConnected ? record.status : FocusStatus.RESTING,
        lastFocusStartTime: isConnected ? record.lastFocusStartTime : null,
        currentTaskId: isConnected ? record.currentTaskId : null,
      }));

      // 2. 어제 레코드: currentTaskId만 null (FK 해제, #362)
      record.currentTaskId = null;
    }

    // 3. 오늘 레코드 + 어제 레코드 한 번에 저장
    await manager.save([...newRecords, ...yesterdayRecords]);
  });

  this.logger.log(
    `Successfully created ${yesterdayRecords.length} new focustime records for today`,
  );
}
```

### 4. 에러 코드 상수 정의 (#364)

**ErrorCodes** (`backend/src/common/error-codes.ts`)

```typescript
export const ErrorCodes = {
  TASK_FOCUSING: 'TASK_FOCUSING',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_NOT_OWNED: 'TASK_NOT_OWNED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
```

### 5. 커스텀 예외 클래스 (#364)

**BaseBusinessException** (`backend/src/common/exceptions/base-business.exception.ts`)

```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

export abstract class BaseBusinessException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
  ) {
    super({ code, message }, status);
  }
}
```

**Task 관련 예외** (`backend/src/task/exceptions/task.exceptions.ts`)

```typescript
import { HttpStatus } from '@nestjs/common';
import { BaseBusinessException } from '../../common/exceptions/base-business.exception';
import { ErrorCodes } from '../../common/error-codes';

export class TaskNotFoundException extends BaseBusinessException {
  constructor() {
    super(
      ErrorCodes.TASK_NOT_FOUND,
      '태스크를 찾을 수 없습니다.',
      HttpStatus.NOT_FOUND,  // 404
    );
  }
}

export class TaskNotOwnedException extends BaseBusinessException {
  constructor() {
    super(
      ErrorCodes.TASK_NOT_OWNED,
      '본인의 태스크만 삭제할 수 있습니다.',
      HttpStatus.FORBIDDEN,  // 403
    );
  }
}

export class TaskFocusingException extends BaseBusinessException {
  constructor() {
    super(
      ErrorCodes.TASK_FOCUSING,
      '집중 중인 태스크는 삭제할 수 없습니다.',
      HttpStatus.BAD_REQUEST,  // 400
    );
  }
}
```

### 6. TaskService 수정 (#362, #364)

**TaskService** (`backend/src/task/task.service.ts`)

```typescript
import { DailyFocusTime, FocusStatus } from '../focustime/entities/daily-focus-time.entity';
import {
  TaskNotFoundException,
  TaskNotOwnedException,
  TaskFocusingException,
} from './exceptions/task.exceptions';

constructor(
  @InjectRepository(Task)
  private readonly taskRepository: Repository<Task>,
  @InjectRepository(DailyFocusTime)
  private readonly focusTimeRepository: Repository<DailyFocusTime>,
  private readonly playerService: PlayerService,
) {}

// findOneById 수정: NotFoundException → TaskNotFoundException
async findOneById(id: number): Promise<Task> {
  const task = await this.taskRepository.findOne({
    where: { id },
    relations: ['player'],
  });
  if (!task) {
    throw new TaskNotFoundException();
  }
  return task;
}

async deleteTask(taskId: number, playerId: number): Promise<void> {
  const task = await this.findOneById(taskId);  // TaskNotFoundException 던짐

  if (task.player.id !== playerId) {
    throw new TaskNotOwnedException();
  }

  // 현재 집중 중인지 확인
  const focusingRecord = await this.focusTimeRepository.findOne({
    where: {
      player: { id: playerId },
      currentTaskId: taskId,
      status: FocusStatus.FOCUSING,
    },
  });

  if (focusingRecord) {
    throw new TaskFocusingException();
  }

  await this.taskRepository.remove(task);
  this.logger.log(`Task deleted (taskId: ${taskId}, playerId: ${playerId})`);
}
```

### 7. 프론트엔드 에러 메시지 매핑 (#364)

**에러 메시지 상수** (`frontend/src/lib/errors/messages.ts`)

```typescript
export const ERROR_MESSAGES: Record<string, string> = {
  TASK_FOCUSING: '집중 중인 태스크는 삭제할 수 없습니다.',
  TASK_NOT_FOUND: '태스크를 찾을 수 없습니다.',
  TASK_NOT_OWNED: '본인의 태스크만 삭제할 수 있습니다.',
};

export const getErrorMessage = (code: string, fallback: string): string => {
  return ERROR_MESSAGES[code] || fallback;
};
```

**스토어 에러 처리** (`frontend/src/stores/useTasksStore.ts`)

```typescript
import { getErrorMessage } from '@/lib/errors/messages';

// deleteTask 내 catch 블록
catch (error) {
  const code = error?.response?.data?.code;
  const message = getErrorMessage(code, 'Task 삭제에 실패했습니다.');
  set({ error: message });
}
```

### 8. TaskModule 수정

**TaskModule** (`backend/src/task/task.module.ts`)

```typescript
import { DailyFocusTime } from '../focustime/entities/daily-focus-time.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, DailyFocusTime]),
    // ...
  ],
  // ...
})
```

### 9. SchedulerModule 수정

**SchedulerModule** (`backend/src/scheduler/scheduler.module.ts`)

```typescript
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyFocusTime]),
    PlayerModule,  // 추가
  ],
  // ...
})
```

---

## 테스트 계획

### 단위 테스트

| 테스트 케이스 | 예상 결과 |
|--------------|----------|
| 스케줄러: 접속 중인 유저의 status가 유지된다 | PASS |
| 스케줄러: 접속 중인 유저의 lastFocusStartTime이 유지된다 (연속 세션) | PASS |
| 스케줄러: 접속 중인 유저의 currentTaskId가 유지된다 | PASS |
| 스케줄러: 미접속 유저의 status가 RESTING이다 | PASS |
| 스케줄러: 미접속 유저의 currentTaskId가 null이다 | PASS |
| 스케줄러: 미접속 유저의 lastFocusStartTime이 null이다 | PASS |
| 스케줄러: 어제 레코드의 currentTaskId가 null이다 | PASS |
| 스케줄러: 트랜잭션으로 실행된다 | PASS |
| TaskService: 없는 Task 삭제 시 TaskNotFoundException (404, TASK_NOT_FOUND) | PASS |
| TaskService: 다른 유저 Task 삭제 시 TaskNotOwnedException (403, TASK_NOT_OWNED) | PASS |
| TaskService: 집중 중인 Task 삭제 시 TaskFocusingException (400, TASK_FOCUSING) | PASS |
| TaskService: 휴식 중인 Task 삭제 시 정상 삭제 | PASS |
| TaskService: 어제 FOCUSING 레코드가 있으면 삭제 차단 (자정 넘김 Fail-safe) | PASS |

### 수동 테스트

> 스케줄러 테스트 시 cron을 임시로 변경하여 테스트 (`0 */1 * * * *` - 매 분 실행)

---

#### 테스트 1: #362 - FK 에러 수정 확인

**목적:** 자정 스케줄러 실행 후 Task 삭제 시 FK 에러가 발생하지 않는지 확인

**사전 조건:**
- 로그인된 상태
- 스케줄러 cron 임시 변경 (`0 */1 * * * *`)

**테스트 단계:**
1. Task 생성 (예: "테스트 태스크")
2. 해당 Task로 집중 시작
3. **휴식하지 않고** 스케줄러 실행 대기 (1분)
4. 스케줄러 로그 확인: `Successfully created N new focustime records`
5. 휴식 버튼 클릭
6. Task 삭제 시도

**예상 결과:**
- ✅ Task 정상 삭제됨
- ✅ FK 에러 없음

**실제 결과:**
| 항목 | 결과 | 비고 |
|------|------|------|
| 스케줄러 실행 | ⬜ | |
| 휴식 전환 | ⬜ | |
| Task 삭제 | ⬜ | |
| **통과 여부** | ⬜ | |

---

#### 테스트 2: #369 - 미접속 유저 RESTING 처리

**목적:** 미접속 상태에서 스케줄러 실행 시 오늘 레코드가 RESTING으로 생성되는지 확인

**사전 조건:**
- 로그인된 상태
- 스케줄러 cron 임시 변경 (`0 */1 * * * *`)
- DB 접근 가능 (SQLite CLI 또는 DB 뷰어)

**테스트 단계:**
1. Task 생성 → 집중 시작
2. 브라우저 탭 닫기 (disconnect)
3. 스케줄러 실행 대기 (1분)
4. DB에서 오늘 생성된 focustime 레코드 확인:
   ```sql
   SELECT id, player_id, status, current_task_id, last_focus_start_time, created_at
   FROM daily_focus_time
   ORDER BY created_at DESC
   LIMIT 5;
   ```
5. 다시 접속하여 상태 확인

**예상 결과:**
- ✅ 오늘 레코드: `status=RESTING`, `current_task_id=NULL`, `last_focus_start_time=NULL`
- ✅ 재접속 시 집중 시간이 잘못 추가되지 않음

**실제 결과:**
| 항목 | 결과 | 비고 |
|------|------|------|
| 브라우저 닫기 (disconnect) | ⬜ | |
| 스케줄러 실행 | ⬜ | |
| 오늘 레코드 status | ⬜ | RESTING 여부 |
| 오늘 레코드 current_task_id | ⬜ | NULL 여부 |
| 재접속 후 정상 동작 | ⬜ | |
| **통과 여부** | ⬜ | |

---

#### 테스트 3: #364 - 집중 중 Task 삭제 차단 메시지

**목적:** 집중 중인 Task 삭제 시도 시 명확한 에러 메시지가 표시되는지 확인

**사전 조건:**
- 로그인된 상태

**테스트 단계:**
1. Task 생성 (예: "삭제 테스트")
2. 해당 Task로 집중 시작
3. **집중 중인 상태에서** Task 삭제 버튼 클릭
4. 에러 메시지 확인

**예상 결과:**
- ✅ 삭제되지 않음
- ✅ "집중 중인 태스크는 삭제할 수 없습니다." 메시지 표시

**실제 결과:**
| 항목 | 결과 | 비고 |
|------|------|------|
| 집중 시작 | ⬜ | |
| 삭제 시도 | ⬜ | |
| 에러 메시지 표시 | ⬜ | 정확한 메시지 확인 |
| Task 유지됨 | ⬜ | |
| **통과 여부** | ⬜ | |

---

#### 테스트 4: 연속 세션 유지 (접속 중 자정 넘김)

**목적:** 접속 중에 자정을 넘기면 집중 상태와 시작 시간이 유지되는지 확인

**사전 조건:**
- 로그인된 상태 (접속 유지)
- 스케줄러 cron 임시 변경 (`0 */1 * * * *`)

**테스트 단계:**
1. Task 생성 → 집중 시작
2. **접속 유지한 채** 스케줄러 실행 대기 (1분)
3. DB에서 오늘 레코드 확인
4. UI에서 집중 상태 및 타이머 확인

**예상 결과:**
- ✅ 오늘 레코드: `status=FOCUSING`, `last_focus_start_time=어제 값 유지`
- ✅ UI 타이머가 연속으로 카운트됨 (리셋되지 않음)

**실제 결과:**
| 항목 | 결과 | 비고 |
|------|------|------|
| 스케줄러 실행 | ⬜ | |
| 오늘 레코드 status | ⬜ | FOCUSING 여부 |
| lastFocusStartTime 유지 | ⬜ | 어제 값인지 확인 |
| UI 타이머 연속 | ⬜ | |
| **통과 여부** | ⬜ | |

---

#### 테스트 5: 어제 레코드 FK 해제 확인

**목적:** 스케줄러 실행 후 어제 레코드의 currentTaskId가 null로 정리되는지 확인

**테스트 단계:**
1. Task 생성 → 집중 시작
2. 스케줄러 실행 대기 (1분)
3. DB에서 어제/오늘 레코드 모두 확인:
   ```sql
   SELECT id, player_id, status, current_task_id, created_at
   FROM daily_focus_time
   WHERE player_id = ?
   ORDER BY created_at DESC
   LIMIT 2;
   ```

**예상 결과:**
- ✅ 어제 레코드: `current_task_id=NULL` (FK 해제됨)
- ✅ 오늘 레코드: 접속 여부에 따라 값 설정

**실제 결과:**
| 항목 | 결과 | 비고 |
|------|------|------|
| 어제 레코드 current_task_id | ⬜ | NULL 여부 |
| 오늘 레코드 생성 | ⬜ | |
| **통과 여부** | ⬜ | |

---

### 테스트 완료 후

- [ ] 스케줄러 cron 원복 (`0 0 0 * * *`)
- [ ] 테스트용 Task/레코드 정리 (필요시)
- [ ] 모든 테스트 통과 확인

---

## 작업 체크리스트

### ~~#370 (disconnect 정산)~~ → 이미 구현됨
> FocusTimeGateway.handleDisconnect에서 startResting() 호출 중

### #369 (스케줄러 미접속 유저 처리)
- [ ] PlayerGateway: `getConnectedPlayerIds()` 메서드 추가
- [ ] PlayerModule: PlayerGateway export 추가
- [ ] SchedulerModule: PlayerModule import 추가
- [ ] FocusTimeMidnightScheduler: PlayerGateway 주입
- [ ] FocusTimeMidnightScheduler: 접속 여부에 따른 분기 처리
- [ ] FocusTimeMidnightScheduler: 접속 중인 유저의 lastFocusStartTime 유지 (연속 세션)

### #362 (FK 정리 + 삭제 차단)
- [ ] FocusTimeMidnightScheduler: 어제 레코드 currentTaskId=null (status는 변경 안 함)
- [ ] FocusTimeMidnightScheduler: 트랜잭션 적용
- [ ] TaskModule: DailyFocusTime 엔티티 import 추가
- [ ] TaskService: DailyFocusTime Repository 주입
- [ ] TaskService: 집중 중 삭제 차단 로직 추가

### #364 (에러 코드 기반 메시지 구조)
- [ ] `backend/src/common/error-codes.ts`: 에러 코드 상수 정의
- [ ] `backend/src/common/exceptions/base-business.exception.ts`: 베이스 예외 클래스
- [ ] `backend/src/task/exceptions/task.exceptions.ts`: Task 관련 예외 클래스
- [ ] TaskService: `findOneById`에서 `TaskNotFoundException` 사용
- [ ] TaskService: `deleteTask`에서 구체적 예외 클래스 사용
- [ ] `frontend/src/lib/errors/messages.ts`: 에러 메시지 매핑
- [ ] `useTasksStore`: 에러 코드 기반 메시지 처리

### 공통
- [ ] 스케줄러 cron 원복 (`0 0 0 * * *`)
- [ ] 단위 테스트 작성
- [ ] CI 통과 확인

### 문서 업데이트
- [ ] `docs/features/FOCUS_TIME.md`: 연속 세션 정책 반영
- [ ] `docs/features/FOCUS_TIME_DETAIL.md`: 자정 스케줄러 동작 업데이트

---

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/player/player.module.ts` | PlayerGateway export 추가 |
| `backend/src/player/player.gateway.ts` | `getConnectedPlayerIds()` 메서드 추가 |
| `backend/src/scheduler/scheduler.module.ts` | PlayerModule import 추가 |
| `backend/src/scheduler/focustime-midnight.scheduler.ts` | 접속 여부 분기 + 트랜잭션 |
| `backend/src/task/task.module.ts` | DailyFocusTime 엔티티 추가 |
| `backend/src/task/task.service.ts` | `findOneById`, `deleteTask` 예외 처리 변경 |
| `backend/src/common/error-codes.ts` | 에러 코드 상수 (신규) |
| `backend/src/common/exceptions/base-business.exception.ts` | 베이스 예외 클래스 (신규) |
| `backend/src/task/exceptions/task.exceptions.ts` | Task 예외 클래스 (신규) |
| `frontend/src/lib/errors/messages.ts` | 에러 메시지 매핑 (신규) |
| `frontend/src/stores/useTasksStore.ts` | 에러 코드 기반 메시지 처리 |
| `docs/features/FOCUS_TIME.md` | 연속 세션 정책 반영 |
| `docs/features/FOCUS_TIME_DETAIL.md` | 자정 스케줄러 동작 업데이트 |
