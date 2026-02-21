# Issue #362, #364, #369: FocusTime 구조 개선 (V2)

## 관련 이슈

- #362: 전날에서 넘어온 태스크 삭제 시 FOREIGN KEY 에러
- #364: 집중 중인 태스크 삭제 시 안내 문구 개선 (프론트엔드)
- #369: 자정 스케줄러에서 미접속 유저의 집중 상태 RESTING으로 변경

---

## 설계 결정

### #369 자정 스케줄러 → 불필요

**기존 문제 (#369)**:
- `daily_focus_time`이 날짜별 레코드 → 자정에 새 레코드 생성 필요
- 미접속 유저의 상태가 어제 레코드에 남음 → 스케줄러로 정리 필요

**V2 해결**:
- 집중 상태를 `player` 테이블에 저장 → 날짜 무관
- 세션 종료 시점에 해당 날짜의 `daily_focus_time`에 정산
- 미접속 유저는 접속 시 stale 세션 정리 (시나리오 7)

**결론**: V2 구조에서는 자정 스케줄러가 **불필요**합니다.

---

## 핵심 변경: 구조 개선

### 기존 구조의 문제

```
daily_focus_time 테이블이 두 가지 역할을 함:
1. 일별 집계 (totalFocusSeconds)
2. 현재 상태 (status, lastFocusStartTime, currentTaskId)

→ 자정에 복사/정리 로직 필요
→ FK 제약 문제 발생
→ 스케줄러 복잡도 증가
```

### 새 구조: 역할 분리

```
┌─────────────────────────────────────┐
│              players                │
├─────────────────────────────────────┤
│ last_focus_start_time: datetime     │ ← 집중 상태 판단 기준 (null=휴식)
│ focusing_task_id: int (신규)        │ ← 현재 집중 Task (선택적, null 허용)
└─────────────────────────────────────┘
        ↓ 현재 상태는 player에서 관리
        ↓ lastFocusStartTime != null → FOCUSING
        ↓ focusing_task_id는 FK 아님 (FK 오류 회피 목적)
        ↓ 대신 애플리케이션 레벨에서 Task 소유권/존재 여부 검증

┌─────────────────────────────────────┐
│          daily_focus_time           │
├─────────────────────────────────────┤
│ total_focus_seconds: int            │ ← 일별 누적만!
│ created_at: datetime                │
│ (status: @deprecated)               │
│ (last_focus_start_time: @deprecated)│
│ (current_task_id: @deprecated)      │
└─────────────────────────────────────┘
        ↓ 순수 집계 테이블
        ↓ deprecated 필드는 엔티티에 @deprecated 유지 (DB 컬럼도 유지)
```

### 장점

| 항목 | 기존 | 개선 |
|-----|------|------|
| 스케줄러 | 필요 (복사/정리) | **불필요** |
| FK 문제 | 정리 필요 | **@deprecated 처리 + FK 미사용으로 해결** |
| 자정 처리 | 복잡 | **없음** |
| 책임 분리 | 혼재 | **명확** |

### Deprecated 필드 정책

`daily_focus_time` 테이블의 아래 필드는 **@deprecated 처리**합니다:
- `status`
- `last_focus_start_time`
- `current_task_id`
- `currentTask`

**방식**: 엔티티 필드 유지 + `@deprecated` JSDoc + ESLint 룰 추가

```typescript
// daily-focus-time.entity.ts
/** @deprecated V2에서 player.lastFocusStartTime으로 이동 */
@Column({ type: 'varchar', default: FocusStatus.RESTING })
status: FocusStatus;
```

```typescript
// eslint.config.mjs - 룰 추가
'@typescript-eslint/no-deprecated': 'error',
```

**이유**:
- `migration:generate` 시 DROP COLUMN 생성 방지
- ESLint에서 사용 시 에러로 잡힘 (CI 실패)
- IDE에서 취소선 표시로 시각적 경고
- DB 컬럼 유지 (SQLite DROP COLUMN 제약)

---

## 설계 가정

### 싱글 인스턴스 배포

- `ecosystem.config.js`에서 `instances: 1`로 설정됨
- 멀티 인스턴스 환경에서는 추가 고려 필요

### 동시 요청 처리

- **세션 중복 방지 구현됨**: `PlayerGateway.userSockets` Map으로 username → socketId 매핑
- 새 탭 접속 시 이전 세션 강제 종료 (`session_replaced` 이벤트 + disconnect)
- startFocusing/startResting은 소켓 이벤트로만 처리 (REST API 없음)
- UI에서 버튼 상태 변경으로 빠른 연속 클릭 방지

> **Note**: 네트워크 재전송 등으로 잔여 race 가능하나, 세션 중복 방지 + Node.js 순차 처리로 실질적 영향 없음

### daily_focus_time 날짜 키 규칙

- `createdAt`은 **KST day start (UTC 기준)** 값으로 명시적 저장
- `getTodayKstRangeUtc().start`를 createdAt에 저장 (기본값 now() 아님)
- 엔티티에서 `@Column` 사용 (`@CreateDateColumn` 아님) → 수동 설정 가능
- 세션 중복 방지 + Node.js 순차 처리로 race condition 없음
- 단순 findOrCreate 패턴 사용

```typescript
// findOrCreate에서 명시적 createdAt 저장
const todayStart = getTodayKstRangeUtc().start;
let record = await manager.findOne(DailyFocusTime, {
  where: { player: { id: playerId }, createdAt: todayStart },
});
if (!record) {
  record = manager.create(DailyFocusTime, {
    player: { id: playerId },
    createdAt: todayStart,  // KST day start 명시
    totalFocusSeconds: 0,
  });
  await manager.save(DailyFocusTime, record);
}
```

### settleCurrentSession 클램프 정책

- `startFocusing`에서 호출되는 `settleCurrentSession`도 동일한 클램프 적용
- `Math.max(0, Math.min(diffSeconds, MAX_SESSION))`

### 데이터 손실 허용 케이스

| 상황 | 동작 | 손실 |
|------|------|------|
| 서버 재시작 | 세션 유지 (DB 저장) | 없음 |
| disconnect 실패 + 24시간 초과 | 24시간까지만 정산, 초과분 무시 | 24시간 초과분 |
| 배포 시점 FOCUSING 유저 | 마이그레이션 시 신규 컬럼 null | 해당 집중 시간 |

→ 기존 문서의 "데이터 손실 허용" 정책과 일관됨

### 타임존 정책

- 서버는 **UTC** 기준
- 일별 집계(`daily_focus_time`)는 **KST 기준 하루** (프론트엔드에서 UTC 범위로 변환하여 조회)
- 오늘 레코드 조회 시 `getTodayKstRangeUtc().start` 사용 (KST 기준 오늘 00:00의 UTC 시각)

---

## 상세 동작

### 집중 시작 (startFocusing)

```typescript
async startFocusing(playerId: number, taskId?: number) {  // taskId는 선택적
  const now = new Date();

  await this.dataSource.transaction(async (manager) => {
    const player = await manager.findOne(Player, { where: { id: playerId } });

    // 1. taskId 정규화 (0, NaN, 음수 → null)
    const normalizedTaskId = (taskId != null && taskId > 0) ? taskId : null;

    // 2. normalizedTaskId가 있으면 소유권 검증
    if (normalizedTaskId) {
      const task = await manager.findOne(Task, {
        where: { id: normalizedTaskId, player: { id: playerId } },
      });
      if (!task) {
        throw new TaskNotOwnedException();  // TASK_NOT_OWNED (400)
      }
    }

    // 3. 이미 집중 중이면 이전 집중 정산
    if (player.lastFocusStartTime) {  // lastFocusStartTime으로 상태 판단
      await this.settleCurrentSession(manager, player, now);
    }

    // 4. 새 집중 시작
    player.focusingTaskId = normalizedTaskId;  // Task 없이도 집중 가능 (글로벌 타이머)
    player.lastFocusStartTime = now;
    await manager.save(Player, player);

    // Note: daily_focus_time 레코드는 종료 시점(startResting)에서 생성
    // 자정을 넘기는 세션은 종료 시점 날짜에 귀속되므로 시작 시 생성 불필요
  });
}
```

### 집중 종료 (startResting)

```typescript
async startResting(playerId: number) {
  const now = new Date();

  // 트랜잭션으로 원자적 업데이트 (경쟁 상황 방지)
  await this.dataSource.transaction(async (manager) => {
    // 1. 트랜잭션 내에서 player 조회 (경쟁 상황 방지)
    const player = await manager.findOne(Player, { where: { id: playerId } });

    // 2. 집중 중이 아니면 무시 (lastFocusStartTime으로 상태 판단)
    if (!player.lastFocusStartTime) {
      return;
    }

    // 3. 집중 시간 계산
    const diffSeconds = Math.floor(
      (now.getTime() - player.lastFocusStartTime.getTime()) / 1000
    );

    // 4. 유효 범위 클램프 (음수 방지 + 24시간 초과 방지)
    const MAX_SESSION = 24 * 60 * 60;
    const validSeconds = Math.max(0, Math.min(diffSeconds, MAX_SESSION));

    // 5. 오늘 daily_focus_time에 누적
    const todayRecord = await this.focusTimeService.findOrCreate(manager, player, getTodayKstRangeUtc().start);
    todayRecord.totalFocusSeconds += validSeconds;
    await manager.save(DailyFocusTime, todayRecord);

    // 6. Task에 누적 (focusingTaskId가 있고, 본인 소유 Task일 때만)
    if (player.focusingTaskId) {
      const task = await manager.findOne(Task, {
        where: { id: player.focusingTaskId, player: { id: playerId } },
      });
      if (task) {
        task.totalFocusSeconds += validSeconds;
        await manager.save(Task, task);
      }
      // Task가 삭제되었거나 소유권 불일치 시 무시 (방어적 처리)
    }

    // 7. player 초기화
    player.focusingTaskId = null;
    player.lastFocusStartTime = null;
    await manager.save(Player, player);
  });
}
```

### Task 삭제

```typescript
async deleteTask(taskId: number, playerId: number) {
  // 트랜잭션으로 race condition 방지
  await this.dataSource.transaction(async (manager) => {
    // 1. Task 존재 확인 (relations 로드)
    const task = await manager.findOne(Task, {
      where: { id: taskId },
      relations: ['player'],
    });
    if (!task) {
      throw new TaskNotFoundException();  // TASK_NOT_FOUND
    }

    // 2. 소유권 확인
    if (task.player.id !== playerId) {
      throw new TaskNotOwnedException();  // TASK_NOT_OWNED
    }

    // 3. 집중 중인 Task면 삭제 차단
    const player = await manager.findOne(Player, { where: { id: playerId } });
    if (player.focusingTaskId === taskId) {
      throw new TaskFocusingException();  // TASK_FOCUSING
    }

    await manager.delete(Task, taskId);
  });
}
```

**검증 순서**: `TASK_NOT_FOUND` → `TASK_NOT_OWNED` → `TASK_FOCUSING`

---

## 시나리오별 동작

### 시나리오 1: 일반 집중/휴식

```
10:00 - 집중 시작 (Task 42)
  → player: { focusingTaskId: 42, lastFocusStartTime: 10:00 }

10:30 - 휴식
  → 시간 계산: 30분
  → daily_focus_time(오늘): += 1800초
  → Task 42: += 1800초
  → player: { focusingTaskId: null, lastFocusStartTime: null }
```

### 시나리오 2: 글로벌 타이머 (Task 없이 집중)

```
10:00 - 집중 시작 (Task 없음)
  → player: { focusingTaskId: null, lastFocusStartTime: 10:00 }

10:30 - 휴식
  → 시간 계산: 30분
  → daily_focus_time(오늘): += 1800초
  → Task 업데이트: 스킵 (focusingTaskId가 null)
  → player: { focusingTaskId: null, lastFocusStartTime: null }
```

### 시나리오 3: 글로벌 타이머 → Task 전환

```
10:00 - 글로벌 집중 시작 (Task 없음)
  → player: { focusingTaskId: null, lastFocusStartTime: 10:00 }

10:15 - Task 42로 전환
  → lastFocusStartTime 존재 → 이전 세션 정산
  → 시간 계산: 15분
  → daily_focus_time(오늘): += 900초
  → Task 업데이트: 스킵 (이전 focusingTaskId가 null)
  → 새 세션 시작
  → player: { focusingTaskId: 42, lastFocusStartTime: 10:15 }

10:45 - 휴식
  → 시간 계산: 30분
  → daily_focus_time(오늘): += 1800초
  → Task 42: += 1800초
  → player: { focusingTaskId: null, lastFocusStartTime: null }

결과: 총 45분 집중, 그 중 30분만 Task 42에 귀속
```

### 시나리오 4: 자정 넘김 연속 세션

```
1/31 23:00 - 집중 시작 (Task 42)
  → player: { focusingTaskId: 42, lastFocusStartTime: 23:00 }

(자정 - 아무 처리 없음!)

2/1 01:00 - 휴식
  → 시간 계산: 2시간
  → daily_focus_time(2/1): findOrCreate → += 7200초
  → Task 42: += 7200초
  → player: { focusingTaskId: null, lastFocusStartTime: null }
```

**스케줄러 없이 정상 동작!**

> **정책**: 자정을 넘기는 세션은 **종료 시점의 날짜에 전체 귀속**됩니다.
> daily_focus_time 레코드는 종료 시점에만 생성되므로 1/31 레코드는 생성되지 않습니다.

### 시나리오 5: 집중 중 Task 삭제 시도

```
상태: player.focusingTaskId = 42

DELETE /api/tasks/42 요청
  → player.focusingTaskId === 42 확인
  → TaskFocusingException (400, TASK_FOCUSING)
  → "집중 중인 태스크는 삭제할 수 없습니다."
```

### 시나리오 6: 서버 재시작 후 접속

```
마이그레이션 후:
  → player.focusingTaskId = null
  → player.lastFocusStartTime = null

유저 접속:
  → lastFocusStartTime = null → 집중 중 아님, 정리 불필요
  → 정상 시작 (레코드 생성 없음, 종료 시점에 생성)
```

### 시나리오 7: 장기 미접속 후 접속

```
1/25 23:00 - 집중 시작 (disconnect 실패)
  → player: { focusingTaskId: 42, lastFocusStartTime: 1/25 23:00 }

2/1 10:00 - 접속
  → 접속 시 정리 로직 실행
  → 시간 계산: 155시간 > 24시간
  → 24시간까지만 정산 (MAX_SESSION 적용)
  → player 초기화
```

---

## 마이그레이션

### SQL

```sql
-- 1. players 테이블에 컬럼 추가
ALTER TABLE players ADD COLUMN focusing_task_id INTEGER;
ALTER TABLE players ADD COLUMN last_focus_start_time DATETIME;

-- 2. 기존 daily_focus_time FK 정리 (#362 해결)
UPDATE daily_focus_time SET current_task_id = NULL;
UPDATE daily_focus_time SET status = 'RESTING';
UPDATE daily_focus_time SET last_focus_start_time = NULL;
```

### TypeORM 마이그레이션

```typescript
// src/database/migrations/TIMESTAMP-AddFocusingFieldsToPlayer.ts
export class AddFocusingFieldsToPlayer implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. players 테이블에 컬럼 추가
    await queryRunner.query(
      `ALTER TABLE players ADD COLUMN focusing_task_id INTEGER`
    );
    await queryRunner.query(
      `ALTER TABLE players ADD COLUMN last_focus_start_time DATETIME`
    );

    // 2. 기존 daily_focus_time FK 정리 (#362 해결)
    await queryRunner.query(
      `UPDATE daily_focus_time SET current_task_id = NULL`
    );
    await queryRunner.query(
      `UPDATE daily_focus_time SET status = 'RESTING'`
    );
    await queryRunner.query(
      `UPDATE daily_focus_time SET last_focus_start_time = NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite는 DROP COLUMN 제한적이므로 생략
  }
}
```

### 배포 후

- 서버 재시작 → 새 컬럼 null
- 기존 FOCUSING 유저 → 자동으로 RESTING 처리
- 별도 데이터 정리 불필요

> ⚠️ **경고**: 마이그레이션 시점에 FOCUSING 상태인 유저의 집중 시간이 **손실**됩니다.
> - 배포 전 Discord/공지로 "잠시 후 서버 점검, 집중 종료 권장" 안내 필요
> - 점심/심야 등 접속자 적은 시간대 배포 권장

---

## 에러 코드 기반 메시지 (#364)

### 백엔드

**에러 코드** (`backend/src/common/error-codes.ts`)

```typescript
export const ErrorCodes = {
  TASK_FOCUSING: 'TASK_FOCUSING',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_NOT_OWNED: 'TASK_NOT_OWNED',
} as const;
```

**예외 클래스** (`backend/src/task/exceptions/task.exceptions.ts`)

```typescript
export class TaskFocusingException extends BaseBusinessException {
  constructor() {
    super(
      ErrorCodes.TASK_FOCUSING,
      '집중 중인 태스크는 삭제할 수 없습니다.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
```

### 프론트엔드

**에러 메시지** (`frontend/src/lib/errors/messages.ts`)

```typescript
export const ERROR_MESSAGES: Record<string, string> = {
  TASK_FOCUSING: '집중 중인 태스크는 삭제할 수 없습니다.',
  TASK_NOT_FOUND: '태스크를 찾을 수 없습니다.',
  TASK_NOT_OWNED: '본인의 태스크만 삭제할 수 있습니다.',
};
```

---

## 작업 체크리스트

### 엔티티 변경

- [x] `Player` 엔티티에 `focusingTaskId`, `lastFocusStartTime` 추가
- [x] `DailyFocusTime` 엔티티에 `@deprecated` JSDoc 추가 (`status`, `lastFocusStartTime`, `currentTaskId`, `currentTask`)
- [x] 마이그레이션 파일 생성 및 실행 (`1769956677231-Auto.ts`)

### ESLint 설정

- [x] `backend/eslint.config.mjs`에 `'@typescript-eslint/no-deprecated': 'error'` 추가
- [x] deprecated 필드 사용 시 린트 에러 발생 확인 (테스트 파일 4곳에서 에러 발생 확인)

### FocusTimeService 수정

- [x] `startFocusing`: player 필드 업데이트 로직 추가
- [x] `startResting`: player 기반 정산 로직으로 변경
- [x] `findOrCreate`: `manager: EntityManager` 파라미터 추가 (트랜잭션 내 실행)
- [x] 24시간 초과 세션 처리 로직 추가

### TaskService 수정

- [x] `deleteTask`: player.focusingTaskId 체크로 변경
- [x] 예외 클래스 적용

### FocusTimeGateway 수정

- [x] `handleDisconnect`: player 기반 정산으로 변경
- [x] 소켓 이벤트 핸들러 업데이트
- [x] `resting` 이벤트에서 `startAt` 파라미터 제거 (V2에서 불필요)

### PlayerGateway 수정

- [x] `handleJoin`: 접속 시 stale 세션 정리 로직 추가
- [x] `joining` 이벤트에서 `startAt` 파라미터 제거 (V2에서 불필요)

### FocusTimeController 수정

- [x] `getFocusTime` 응답에서 `totalFocusSeconds`만 반환 (V2에서 status, lastFocusStartTime은 player에서 관리)

### 스케줄러 제거

- [x] `FocusTimeMidnightScheduler` 삭제
- [x] `SchedulerModule`에서 제거

### 에러 코드 (#364)

- [x] `backend/src/common/error-codes.ts` 생성
- [x] `backend/src/common/exceptions/base-business.exception.ts` 생성
- [x] `backend/src/task/exceptions/task.exceptions.ts` 생성
- [x] `frontend/src/lib/errors/messages.ts` 생성
- [x] `frontend/src/lib/api/client.ts`에 `ApiError` 클래스 추가
- [x] `useTasksStore` 에러 처리 수정

### 테스트

- [ ] 단위 테스트 업데이트
- [x] 수동 테스트 수행 (테스트 1~5 모두 완료)

### 문서 업데이트

- [ ] `docs/features/FOCUS_TIME.md` 업데이트
- [ ] `docs/features/FOCUS_TIME_DETAIL.md` 업데이트
- [ ] `docs/guides/ERD.md` 업데이트

---

## 테스트 계획

### 수동 테스트

#### 테스트 1: 일반 집중/휴식 ✅

1. Task 생성 → 집중 시작
2. 30초 후 휴식
3. 확인: daily_focus_time에 30초 누적, Task에 30초 누적

#### 테스트 2: 집중 중 Task 삭제 차단 ✅

1. Task 생성 → 집중 시작
2. Task 삭제 시도
3. 확인: "집중 중인 태스크는 삭제할 수 없습니다." 에러 (서버 요청 없이 즉시 표시)

> **구현**: 프론트엔드에서 `isRunning` Task는 서버 요청 없이 즉시 에러 표시 (`useTasksStore.ts`)

#### 테스트 3: 휴식 후 Task 삭제 ✅

1. Task 생성 → 집중 시작 → 휴식
2. Task 삭제 시도
3. 확인: 정상 삭제됨 (낙관적 업데이트)

#### 테스트 4: 서버 재시작 후 상태 ✅

1. 마이그레이션 실행
2. 서버 재시작
3. 접속
4. 확인: RESTING 상태로 시작

> 마이그레이션 이미 완료됨. 테스트 1~3 진행 시 정상 접속 확인.

#### 테스트 5: 자정 넘김 연속 세션 (DB 조작) ✅

1. Task 생성 → 집중 시작
2. DB에서 `last_focus_start_time`을 어제 날짜로 수정
   ```sql
   UPDATE players
   SET last_focus_start_time = datetime('now', '-1 day', '-1 hour')
   WHERE id = ?;
   ```
3. 휴식 버튼 클릭
4. 확인:
   - `daily_focus_time`이 **오늘 날짜**에 생성됨 ✅
   - 어제 레코드는 생성되지 않음 (V2 정책: 종료 시점 날짜에 귀속) ✅
   - `player.last_focus_start_time`이 null로 초기화됨 ✅

---

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/player/entites/player.entity.ts` | focusingTaskId, lastFocusStartTime 추가 |
| `backend/src/database/migrations/` | 마이그레이션 파일 추가 (TODO) |
| `backend/src/focustime/focustime.service.ts` | player 기반 로직으로 변경 |
| `backend/src/focustime/focustime.gateway.ts` | player 기반 로직으로 변경, resting에서 startAt 제거 |
| `backend/src/focustime/focustime.controller.ts` | totalFocusSeconds만 반환하도록 변경 |
| `backend/src/focustime/focustime.module.ts` | Player 엔티티 import 추가 |
| `backend/src/task/task.service.ts` | 삭제 로직 변경, 예외 클래스 적용 |
| `backend/src/player/player.gateway.ts` | 접속 시 stale 세션 정리, joining에서 startAt 제거 |
| `backend/src/player/player.module.ts` | Task 엔티티 import 추가 |
| `backend/src/scheduler/scheduler.module.ts` | FocusTimeMidnightScheduler 제거 |
| `backend/src/scheduler/focustime-midnight.scheduler.ts` | 삭제됨 |
| `backend/src/common/error-codes.ts` | 에러 코드 (신규) |
| `backend/src/common/exceptions/base-business.exception.ts` | 기본 예외 클래스 (신규) |
| `backend/src/task/exceptions/task.exceptions.ts` | Task 예외 클래스 (신규) |
| `frontend/src/lib/errors/messages.ts` | 에러 메시지 (신규) |
| `frontend/src/lib/api/client.ts` | ApiError 클래스 추가 |
| `frontend/src/lib/api/index.ts` | ApiError export 추가 |
| `backend/src/focustime/entites/daily-focus-time.entity.ts` | @deprecated JSDoc 추가 |
| `backend/eslint.config.mjs` | `@typescript-eslint/no-deprecated` 룰 추가 |
| `frontend/src/stores/useTasksStore.ts` | 에러 처리 수정 |

---

## 이전 문서와의 차이

| 항목 | V1 (이전) | V2 (현재) |
|-----|----------|----------|
| 집중 상태 저장 | daily_focus_time | **player** |
| 스케줄러 | 필요 | **불필요** |
| FK 정리 | 필요 | **불필요** |
| 마이그레이션 | 없음 | 컬럼 추가 2개 |
| 복잡도 | 높음 | **낮음** |

---

## 발견된 버그

### BUG-1: findOrCreate 중복 레코드 생성 (해결됨)

**발견일**: 2026-02-01

**증상**:
- `daily_focus_time` 테이블에 같은 `created_at`으로 여러 레코드 생성됨
- 예: `2026-02-01 07:13:00`에 id=22~28 (7개, 모두 0초)

**원인 분석**:
- V2 코드의 `findOrCreate`는 정상 동작 확인됨
- 중복 레코드는 V1 코드 또는 마이그레이션 전에 생성된 레거시 데이터
- 날짜가 바뀌면 새 범위로 조회하므로 어제 레코드를 못 찾는 것은 정상 동작

**검증 결과** (2026-02-02):
```
todayStart=2026-02-01T15:00:00.000Z, todayEnd=2026-02-02T14:59:59.999Z
existing=id=29, createdAt=2026-02-01 15:00:00 (정상)
```

**상태**: ✅ 해결됨 (V2 코드 정상 동작 확인)
