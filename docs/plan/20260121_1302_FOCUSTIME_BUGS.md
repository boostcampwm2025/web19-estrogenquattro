# FocusTime 미해결 버그

**최종 업데이트:** 2026-01-22

---

## 작업 지침

각 이슈 작업 시 다음 순서를 따릅니다:

1. **원인 분석** - 문제의 근본 원인 파악
2. **해결방법 제시** - 가능한 여러 해결방법 나열
3. **장단점 비교** - 각 해결방법의 장단점 분석
4. **권장안 제시** - 상황에 맞는 권장 해결방법 제안
5. **선택 후 진행** - 사용자가 선택하면 구현 시작

---

## 미해결 이슈 목록

| 이슈 | 제목 | 상태 |
|------|------|------|
| #124 | 로컬 플레이어 탭 비활성화 시 타이머 부정확 | ✅ 해결 |
| #126 | DB 누적 집중 시간 초 단위로 변경 | ✅ 해결 |
| #162 | 자정 기준 일일 데이터 초기화 및 정산 | ❌ 미해결 |
| #164 | 개별 태스크 집중 시간이 서버에 저장되지 않음 | ✅ 해결 |
| #165 | FocusTime Race Condition - 트랜잭션 미사용 | ⏭️ 스킵 (발생 불가) |
| #166 | FocusTime 소켓 이벤트 클라이언트 응답 누락 | ✅ 해결 |
| #167 | FocusTime Disconnect 시 에러 처리 미흡 | ⏭️ 스킵 (구분 불필요) |
| #159 | 서버 접속 끊김 감지를 위한 하트비트 구현 | ❌ 미해결 |
| #181 | 새 플레이어 입장 시 기존 플레이어의 태스크 이름 미표시 | ❌ 미해결 |

---

## #124: 로컬 플레이어 탭 비활성화 시 타이머 부정확 ✅

### 현상

```
1. 집중 모드 시작 (0분)
2. 다른 탭으로 이동 (10분 대기)
3. 원래 탭으로 복귀
4. 표시: 2~3분 (실제: 10분) ❌
```

### 원인

**현재 코드 (TasksMenu.tsx):**
```typescript
useEffect(() => {
  if (isTimerRunning) {
    interval = window.setInterval(() => {
      incrementFocusTime();  // ❌ 매 콜백마다 +1초
    }, 1000);
  }
}, [isTimerRunning]);
```

- 브라우저가 비활성 탭의 `setInterval`을 쓰로틀링 (최대 1분 간격)
- 콜백이 호출될 때만 `+1` 증가 → 시간 손실

### 해결 방안

**경과 시간 기반 계산으로 변경:**

```typescript
useEffect(() => {
  if (isTimerRunning) {
    interval = window.setInterval(() => {
      const { focusStartTimestamp, baseFocusSeconds } = useFocusTimeStore.getState();
      if (focusStartTimestamp) {
        const elapsed = Math.floor((Date.now() - focusStartTimestamp) / 1000);
        setFocusTime(baseFocusSeconds + elapsed);  // ✅ 항상 정확
      }
    }, 1000);
  }
}, [isTimerRunning]);
```

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/stores/useFocusTimeStore.ts` | `baseFocusSeconds` 상태 추가 |
| `frontend/src/app/_components/TasksMenu/TasksMenu.tsx` | 경과 시간 기반 계산 |

### 체크리스트

- [x] `useFocusTimeStore.ts`에 `baseFocusSeconds` 상태 추가
- [x] `syncFromServer`에서 `baseFocusSeconds` 설정
- [x] `startFocusing`에서 `baseFocusSeconds: focusTime` 설정
- [x] `TasksMenu.tsx` 경과 시간 기반 계산으로 변경
- [x] 테스트: 탭 비활성화 1분/10분 후 복귀 시 정확한 시간 표시

### 해결

- **PR**: #134
- **커밋**: `6604cc1`
- **브랜치**: `fix/#121-focustime-refresh`

---

## #126: DB 누적 집중 시간 초 단위로 변경 ✅

### 현상

- User A가 5분 30초 집중 후 휴식
- 다른 사용자는 User A의 시간을 **5분**으로 표시 (30초 손실)

### 원인

**현재 코드 (focustime.service.ts):**
```typescript
const diffMins = Math.floor(diffMs / 1000 / 60);  // 초가 버려짐
focusTime.totalFocusMinutes += diffMins;
```

- `Math.floor`로 분 단위 변환 시 **59초까지 손실** 가능
- 짧은 집중 세션이 반복되면 누적 손실 증가

### 해결방법 비교

| 방법 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A** | DB 컬럼을 `totalFocusSeconds`로 변경 | 가장 정확, 코드 단순화, 향후 확장 유리 | DB 마이그레이션 필요, 하위호환 처리 필요 |
| **B** | DB는 분 유지, `remainingSeconds` 컬럼 추가 | 기존 데이터 보존, 마이그레이션 단순 | 필드 2개 관리 복잡, 계산 로직 복잡 |
| **C** | DB는 분 유지, 클라이언트만 초 단위 | 서버 변경 없음 | 근본 해결 아님, DB에 손실 누적 |

### 선택: 방법 A ✅

**이유:**
1. **근본 해결** - 초 단위 저장으로 손실 완전 제거
2. **#164와 연계** - Task 테이블도 초 단위로 통일 가능
3. **코드 단순화** - 분/초 변환 로직 불필요
4. **Dual-field 전략**으로 하위호환 해결 가능

### 수정 파일

| 영역 | 파일 | 변경 내용 |
|------|------|----------|
| Backend | `daily-focus-time.entity.ts` | `totalFocusSeconds` 컬럼 |
| Backend | `task.entity.ts` | `totalFocusSeconds` 컬럼 (#164와 연관) |
| Backend | `focustime.service.ts` | 초 단위 계산 |
| Backend | `focustime.gateway.ts` | `totalFocusSeconds` 전송 |
| Backend | `player.gateway.ts` | `totalFocusSeconds` 전송 |
| Backend | 마이그레이션 | 테이블 재생성 (분→초 변환) |
| Frontend | `useFocusTimeStore.ts` | `totalFocusSeconds` 사용 |
| Frontend | `SocketManager.ts` | `totalFocusSeconds` 사용 |
| Frontend | `RemotePlayer.ts` | `totalFocusSeconds` 사용 |
| Docs | SOCKET_EVENTS.md, ERD.md 등 | 필드 변경 반영 |

### 전환 전략: 직접 전환 (방식 B) ✅

| 방식 | 설명 |
|------|------|
| Dual-Field (A) | 백엔드가 두 필드 전송, 프론트가 fallback 처리, 점진적 제거 |
| **직접 전환 (B)** | 이번 PR에서 프론트/백 모두 `totalFocusSeconds`로 완전 전환 |

**선택 이유:**
- 단일 PR로 프론트/백 동시 배포 가능
- deprecated 필드 관리 부담 없음
- 코드 깔끔함

### DB 마이그레이션 (SQLite)

SQLite `DROP COLUMN` 호환성 문제로 **테이블 재생성 방식** 사용:

```sql
-- 1. 새 테이블 생성
CREATE TABLE daily_focus_time_new (..., total_focus_seconds INTEGER);

-- 2. 데이터 복사 (분 → 초 변환)
INSERT INTO daily_focus_time_new SELECT ..., total_focus_minutes * 60 FROM daily_focus_time;

-- 3. 기존 테이블 삭제 & 이름 변경
DROP TABLE daily_focus_time;
ALTER TABLE daily_focus_time_new RENAME TO daily_focus_time;
```

### 체크리스트

**Backend:**
- [x] Entity 컬럼명 변경 (`totalFocusMinutes` → `totalFocusSeconds`)
- [x] Service 계산 로직 변경 (분 → 초)
- [x] Gateway 이벤트 `totalFocusSeconds` 적용
- [x] DB 마이그레이션 작성
- [x] 테스트 수정 (`focustime.service.spec.ts`, `focustime.e2e-spec.ts`, `task.service.spec.ts`)

**Frontend:**
- [x] `FocusTimeData` 인터페이스에 `totalFocusSeconds` 적용
- [x] `useFocusTimeStore` 수정
- [x] `SocketManager` 수정
- [x] `RemotePlayer` 수정
- [x] 테스트 수정 (5개 파일)

**Docs:**
- [x] SOCKET_EVENTS.md
- [x] ERD.md
- [x] FOCUS_TIME.md
- [x] REST_ENDPOINTS.md
- [x] DATABASE.md
- [x] GAME_ENGINE.md

### 해결

- **PR**: #168
- **커밋**: `ccdae2d`
- **브랜치**: `fix/#126-focustime-seconds`

---

## #164: 개별 태스크 집중 시간이 서버에 저장되지 않음 ✅

### 현상

```
1. 태스크 생성 후 집중 모드 시작
2. 해당 태스크로 5분간 집중
3. 휴식 버튼 클릭
4. 페이지 새로고침
5. 태스크의 집중 시간이 0분으로 표시됨 ❌
```

### 원인

| 계층 | 필드 | 저장 위치 | 업데이트 로직 |
|------|------|----------|--------------|
| DailyFocusTime | totalFocusMinutes | DB | startResting에서 누적 ✅ |
| Task | totalFocusMinutes | DB | **없음 ❌** |
| Task (프론트) | time | 로컬 메모리 | incrementTaskTime +1초 |

- `resting` 이벤트 발생 시 `DailyFocusTime`만 업데이트
- `Task.totalFocusMinutes`는 업데이트하는 로직이 없음

### 해결 방안

1. `focusing` 이벤트에 `taskId` 추가
2. `FocusTimeService`에서 현재 집중 중인 `taskId` 저장
3. `startResting` 시 해당 Task의 `totalFocusMinutes` (또는 `totalFocusSeconds`) 업데이트

### 수정 파일

| 영역 | 파일 | 변경 내용 |
|------|------|----------|
| Backend | `daily-focus-time.entity.ts` | `currentTaskId` 필드 추가 (nullable) |
| Backend | `focustime.service.ts` | `startFocusing`에 taskId 저장, `startResting`에서 Task 시간 업데이트 |
| Backend | `focustime.gateway.ts` | `focusing` 이벤트에 taskId 처리 |
| Backend | `task.service.ts` | `addFocusTime(taskId, seconds)` 메서드 추가 |
| Frontend | `useFocusTimeStore.ts` | `startFocusing`에 taskId 전송 |
| Frontend | `useTasksStore.ts` | 서버 응답으로 task.time 동기화 |

### 체크리스트

- [x] `focusing` 이벤트에 `taskId` 추가
- [x] `DailyFocusTime` 엔티티에 `currentTaskId` 필드 추가
- [x] `startFocusing`에서 `currentTaskId` 저장
- [x] `startResting`에서 해당 Task의 집중 시간 업데이트
- [x] 프론트엔드에서 `focusing` 이벤트 전송 시 `taskId` 포함
- [x] 새로고침 시 Task 시간 서버에서 복원 확인
- [x] 테스트 추가

### 테스트

| 파일 | 테스트 케이스 |
|------|--------------|
| `focustime.service.spec.ts` | taskId를 전달하면 currentTaskId가 저장된다 |
| `focustime.service.spec.ts` | taskId 없이 호출하면 currentTaskId가 null이다 |
| `focustime.service.spec.ts` | currentTaskId가 있고 집중 시간이 있으면 Task의 totalFocusSeconds가 업데이트된다 |
| `focustime.service.spec.ts` | currentTaskId가 없으면 Task 업데이트가 발생하지 않는다 |

### 관련 이슈

- #126: Task 테이블도 `totalFocusMinutes` → `totalFocusSeconds` 변경 필요

### 해결

- **PR**: #170
- **커밋**: `e2ace45`, `a6a71ac`
- **브랜치**: `fix/#164-task-focustime` (Stacked PR on `fix/#126-focustime-seconds`)

---

## #162: 자정 기준 일일 데이터 초기화 및 정산

### 현상

- 자정이 지나도 일일 집중 시간이 초기화되지 않음
- 완료된 투두가 정리되지 않음
- 포인트 정산이 자동으로 이루어지지 않음

### 기획 요구사항 (pre-report.md 기준)

| 대상 | 자정 처리 |
|------|----------|
| 일일 총 집중시간 | 초기화 |
| 집중시간 정산 | 포인트 히스토리로 기록 |
| 완료된 투두 | 스냅샷 저장 후 정리 |
| 미완료 투두 | 다음 날 이월 |
| 진행 중 타이머 | 자정 이후에도 누적 유지 (예외) |

### 현재 구현 상태

- `@nestjs/schedule` 모듈 미사용
- 스케줄러/Cron 로직 없음
- 일일 데이터 자동 초기화 기능 미구현

### 해결 방안

NestJS `@nestjs/schedule` 모듈의 `@Cron` 데코레이터 사용

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DailyResetService {
  @Cron('0 0 * * *') // 매일 자정
  async handleDailyReset() {
    // 1. 집중시간 정산 → 포인트 히스토리 기록
    // 2. 완료된 투두 스냅샷 저장
    // 3. 일일 집중시간 초기화 (새 DailyFocusTime 레코드)
  }
}
```

### 수정 파일

| 영역 | 파일 | 변경 내용 |
|------|------|----------|
| Backend | `app.module.ts` | `ScheduleModule.forRoot()` 추가 |
| Backend | `daily-reset.service.ts` (신규) | 자정 초기화 로직 |
| Backend | `focustime.service.ts` | 일일 정산 메서드 추가 |
| Backend | `task.service.ts` | 완료 투두 스냅샷/정리 메서드 추가 |
| Backend | `point.service.ts` | 집중시간 포인트 정산 메서드 추가 |

### 체크리스트

- [ ] `@nestjs/schedule` 패키지 설치
- [ ] `ScheduleModule.forRoot()` 등록
- [ ] `DailyResetService` 생성
- [ ] 집중시간 → 포인트 정산 로직
- [ ] 완료된 투두 스냅샷 저장
- [ ] 미완료 투두 이월 처리
- [ ] 진행 중 타이머 예외 처리 (자정 이후에도 유지)
- [ ] 테스트 추가

### 주의사항

- **진행 중인 타이머**: 자정에 집중 중인 사용자의 타이머는 중단하지 않고 누적 유지
- **타임존**: 서버 타임존 설정 확인 (KST 기준 00:00)
- **서버 재시작**: 서버 재시작 시에도 스케줄러가 정상 동작하는지 확인

---

## #165: FocusTime Race Condition - 트랜잭션 미사용 ⏭️

> **스킵 사유**: 현재 아키텍처에서 발생 확률이 매우 낮고, 기존 방지 메커니즘으로 충분히 완화됨

### 현상

`startFocusing`/`startResting`에서 SELECT → UPDATE 사이에 트랜잭션이 없어서 동시 요청 시 **데이터 덮어쓰기** 발생 가능

### 문제 코드

```typescript
// focustime.service.ts
async startResting(playerId: number): Promise<DailyFocusTime> {
  const focusTime = await this.focusTimeRepository.findOne({...});  // SELECT
  // ← 이 사이에 다른 요청이 끼어들 수 있음 (비동기)
  focusTime.totalFocusMinutes += diffMins;
  return this.focusTimeRepository.save(focusTime);  // UPDATE
}
```

### 시나리오: focusing ↔ resting 교차 시 시간 손실

```
초기: totalFocusMinutes=10, status=FOCUSING, lastFocusStartTime=10:00

T1: Request A (resting) - findOne() → { totalFocusMinutes: 10, status: FOCUSING }
T2: Request B (focusing) - findOne() → { totalFocusMinutes: 10, status: FOCUSING }
T3: Request A - save() → { totalFocusMinutes: 15, status: RESTING }
T4: Request B - save() → { totalFocusMinutes: 10, status: FOCUSING }  ← 덮어쓰기!

결과: 5분 손실! (15 → 10으로 롤백됨)
```

### 발생 조건

- 사용자가 "집중"/"휴식" 버튼을 빠르게 연속 클릭
- 네트워크 지연으로 동일 이벤트가 중복 전송
- 여러 탭에서 동시에 조작

### 현재 동작하는 이유

- Node.js 단일 스레드 특성상 완전한 병렬 실행은 없음
- 낮은 트래픽으로 race condition 발현 확률 낮음
- 대부분 `await`로 순차 처리됨

### 해결 방안

**방안 1: Pessimistic Locking**

```typescript
async startResting(playerId: number): Promise<DailyFocusTime> {
  return this.focusTimeRepository.manager.transaction(async (tm) => {
    const focusTime = await tm.findOne(DailyFocusTime, {
      where: { player: { id: playerId }, createdDate: today },
      lock: { mode: 'pessimistic_write' }  // SELECT FOR UPDATE
    });

    // 이미 RESTING이면 무시 (중복 방지)
    if (focusTime.status === FocusStatus.RESTING) {
      return focusTime;
    }

    // 시간 누적 및 상태 변경
    focusTime.totalFocusMinutes += diffMins;
    focusTime.status = FocusStatus.RESTING;
    return tm.save(focusTime);
  });
}
```

**방안 2: 중복 호출 방지**

```typescript
// 이미 같은 상태면 무시
if (focusTime.status === FocusStatus.RESTING) {
  return focusTime;  // 변경 없이 반환
}
```

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/focustime/focustime.service.ts` | 트랜잭션 + Lock 추가, 중복 호출 방지 |

### 체크리스트

- [ ] ~~`startFocusing`에 트랜잭션 또는 Lock 추가~~
- [ ] ~~`startResting`에 트랜잭션 또는 Lock 추가~~
- [ ] ~~이미 같은 상태면 무시하는 로직 추가~~
- [ ] ~~테스트 추가~~

### 스킵 결정

**이론적 발생 조건과 현재 방지 메커니즘:**

| 조건 | 방지 메커니즘 |
|------|--------------|
| 여러 탭 동시 조작 | `session_replaced` 이벤트로 이전 세션 자동 종료 |
| 더블 클릭 | 프론트엔드 UI 버튼 상태 관리 |
| 네트워크 재시도 | Socket.io 자체 관리 |

**추가 안전 요소:**
- Node.js 단일 스레드: 진정한 병렬 실행 없음
- `await` 순차 처리: 대부분 순서대로 실행
- SQLite 쓰기 직렬화: 동시 쓰기 자동 차단

**결론:** 현재 아키텍처에서 Race Condition 발생 확률이 매우 낮음. 다만 비동기 소켓 핸들러 특성상 이론적으로 SELECT→UPDATE 인터리브 가능성이 완전히 0은 아님. 추후 다중 서버 환경이나 DB 변경 시 재검토 필요.

- **GitHub 이슈**: #165 (closed, not planned)

---

## #166: FocusTime 소켓 이벤트 클라이언트 응답 누락 ✅

### 현상

소켓 이벤트 핸들러(`focusing`, `resting`)가 클라이언트에 성공/실패 응답을 보내지 않음

### 문제점

| 상황 | 현재 동작 | 사용자 경험 |
|------|----------|------------|
| 서버 처리 성공 | 응답 없음 | 성공했는지 알 수 없음 |
| 서버 처리 실패 | 응답 없음 | 실패했는지 알 수 없음 |
| 네트워크 지연 | 응답 없음 | 무한 대기 |

### 시나리오

```
1. 사용자가 "집중" 버튼 클릭
2. 클라이언트: emit('focusing') 전송
3. 서버: DB 에러 발생 (예: NotFoundException)
4. 클라이언트: 응답이 없어서 성공한 줄 알고 UI를 "집중 중"으로 변경
5. 결과: 클라이언트 UI ↔ 서버 상태 불일치
```

### 현재 코드

```typescript
// focustime.gateway.ts
@SubscribeMessage('focusing')
async handleFocusing(@ConnectedSocket() client, @MessageBody() data) {
  await this.focusTimeService.startFocusing(playerId);
  client.to(roomId).emit('focused', {...});  // 다른 사람에게만 전송
  // 본인에게는 응답 없음 ❌
}
```

### 해결 방안

```typescript
// 서버
@SubscribeMessage('focusing')
async handleFocusing(...) {
  try {
    const focusTime = await this.focusTimeService.startFocusing(playerId);
    client.to(roomId).emit('focused', {...});
    return { success: true, data: focusTime };  // 본인에게 응답
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 클라이언트 (선택)
socket.emit('focusing', { taskName }, (response) => {
  if (!response.success) {
    // 에러 표시, UI 롤백
  }
});
```

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/focustime/focustime.gateway.ts` | try-catch + return 응답 추가 |
| `frontend/src/stores/useFocusTimeStore.ts` | 응답 처리 (선택) |

### 체크리스트

- [x] `handleFocusing`에 try-catch + return 응답 추가
- [x] `handleResting`에 try-catch + return 응답 추가
- [x] `handleFocusTaskUpdating`에 try-catch + return 응답 추가
- [x] 프론트엔드 응답 처리 (에러 시 롤백)
- [ ] 테스트 추가

### 해결

- **PR**: #176
- **커밋**: `d475dcf`
- **브랜치**: `fix/#166-socket-response` (Stacked PR on `fix/#164-task-focustime`)

---

## #167: FocusTime Disconnect 시 에러 처리 미흡 ⏭️

> **스킵 사유**: 에러 타입 구분의 실질적 가치 없음

### 현상 (원래 이슈)

Disconnect 시 `startResting()` 호출이 실패해도 로깅만 하고 무시 → 집중 시간 손실 가능

### 분석 결과

`startResting` 실제 동작을 분석한 결과:

```typescript
async startResting(playerId: number): Promise<DailyFocusTime> {
  const focusTime = await this.focusTimeRepository.findOne({...});

  // 레코드가 없을 때만 NotFoundException
  if (!focusTime) {
    throw new NotFoundException(...);
  }

  // 이미 RESTING이면 시간 계산 없이 그냥 넘어감 (예외 X)
  if (focusTime.status === FocusStatus.FOCUSING && focusTime.lastFocusStartTime) {
    // 집중 시간 계산...
  }

  focusTime.status = FocusStatus.RESTING;
  return this.focusTimeRepository.save(focusTime);
}
```

### 실제 동작

| 상황 | 동작 |
|------|------|
| 집중 중 (FOCUSING) → Disconnect | 시간 계산 후 RESTING으로 변경 ✓ |
| 이미 RESTING → Disconnect | **예외 없이** RESTING 유지 ✓ |
| 레코드 없음 → Disconnect | `NotFoundException` 발생 |

### NotFoundException 발생 케이스

1. **서버 재시작**: 클라이언트 재연결 시 disconnect 발생하지만 새 서버에는 `findOrCreate` 미호출
2. **자정 경과**: 23:59 접속 → 00:01 disconnect → 날짜 변경으로 레코드 없음
3. **비정상 연결**: join 없이 disconnect만 발생하는 엣지 케이스

### 스킵 결정

- "이미 RESTING"인 경우 예외가 발생하지 않음 → 에러 타입 구분 불필요
- `NotFoundException`은 엣지 케이스에서만 발생하며, 현재 warn 레벨 로깅으로 충분
- 에러 타입에 따른 처리 분기의 실질적 가치 없음

**GitHub 이슈**: #167 (closed, not planned)

---

## #159: 서버 접속 끊김 감지를 위한 하트비트 구현

### 현상

- 서버 연결이 끊겨도 클라이언트에서 감지 못함
- 다른 플레이어가 나간 것도 즉시 반영되지 않을 수 있음
- Socket.io 기본 ping/pong과 별개로 애플리케이션 레벨 하트비트 필요

### 영향

| 상황 | 현재 동작 | 사용자 경험 |
|------|----------|------------|
| 서버 다운 | 클라이언트 무반응 | 집중 버튼 클릭해도 반응 없음, 원인 모름 |
| 네트워크 끊김 | 감지 안 됨 | 시간이 계속 흐르지만 서버에 저장 안 됨 |
| 다른 플레이어 끊김 | 즉시 반영 안 될 수 있음 | 나간 플레이어가 계속 보임 |

### 해결 방안

**Socket.io 기본 옵션 활용:**

```typescript
// 서버
const io = new Server(server, {
  pingInterval: 10000,  // 10초마다 ping
  pingTimeout: 5000,    // 5초 내 응답 없으면 disconnect
});

// 클라이언트
const socket = io({
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on('disconnect', (reason) => {
  // UI에 연결 끊김 표시
});

socket.on('reconnect', () => {
  // 상태 재동기화
});
```

**애플리케이션 레벨 하트비트 (선택):**

```typescript
// 서버
setInterval(() => {
  io.emit('heartbeat', { timestamp: Date.now() });
}, 10000);

// 클라이언트
let lastHeartbeat = Date.now();
socket.on('heartbeat', () => {
  lastHeartbeat = Date.now();
});

setInterval(() => {
  if (Date.now() - lastHeartbeat > 30000) {
    // 30초간 하트비트 없으면 연결 끊김으로 간주
    showDisconnectedOverlay();
  }
}, 5000);
```

### 수정 파일

| 영역 | 파일 | 변경 내용 |
|------|------|----------|
| Backend | `main.ts` 또는 Gateway | Socket.io 옵션 설정 |
| Frontend | `lib/socket.ts` | reconnection 옵션, disconnect/reconnect 핸들러 |
| Frontend | UI 컴포넌트 | 연결 끊김 오버레이, 재연결 버튼 |

### 체크리스트

- [ ] 하트비트 주기 결정 (예: 10초, 30초)
- [ ] 서버: Socket.io pingInterval, pingTimeout 설정
- [ ] 클라이언트: reconnection 옵션 설정
- [ ] 클라이언트: disconnect/reconnect 이벤트 핸들링
- [ ] UI: 연결 끊김 상태 표시 (오버레이)
- [ ] UI: 재연결 버튼 또는 자동 재연결 표시
- [ ] 재연결 시 상태 동기화 (FocusTime, 플레이어 위치 등)

### 참고

- Socket.io 기본 heartbeat: `pingInterval`, `pingTimeout` 옵션
- FocusTime 동기화는 경과 시간 기반 방식 사용 (하트비트 X)
- 이 이슈는 FocusTime 동기화가 아닌 **연결 상태 감지** 목적

---

## #181: 새 플레이어 입장 시 기존 플레이어의 태스크 이름 미표시

### 현상

```
1. 플레이어 A가 "코딩하기" 태스크로 집중 시작
2. 플레이어 B가 같은 방에 입장
3. B의 화면에서 A가 "작업중"으로만 표시됨 ❌ (예상: "코딩하기")
```

### 원인

`player.gateway.ts`의 `players_synced` 이벤트에서 `taskName`이 누락됨:

```typescript
// 현재 코드 (156-173줄)
return {
  ...p,
  status: status?.status ?? 'RESTING',
  lastFocusStartTime: status?.lastFocusStartTime?.toISOString() ?? null,
  totalFocusSeconds: status?.totalFocusSeconds ?? 0,
  currentSessionSeconds,
  // ❌ taskName 없음!
};
```

| 이벤트 | taskName 포함 | 결과 |
|--------|--------------|------|
| `focused` (집중 시작) | ✅ | 실시간으로 taskName 표시됨 |
| `players_synced` (입장 시) | ❌ | "작업중"만 표시 |

### 해결 방안

1. `DailyFocusTime.currentTaskId`를 기반으로 Task의 description 조회
2. `players_synced` 이벤트에 `taskName` 필드 추가

### 수정 파일

| 영역 | 파일 | 변경 내용 |
|------|------|----------|
| Backend | `focustime.service.ts` | `findAllStatuses()`에서 currentTask 관계 로드 |
| Backend | `player.gateway.ts` | `statusMap`에 taskName 추가, `players_synced`에 포함 |

### 체크리스트

- [ ] `focusTimeService.findAllStatuses()`에서 currentTask 관계 로드
- [ ] `statusMap`에 taskName 추가
- [ ] `players_synced` 이벤트 응답에 taskName 포함
- [ ] 테스트 추가

---

## 작업 순서

### 1. #124 ✅ (완료)
- PR #134에 커밋 추가
- 프론트엔드만 수정

### 2. #126 ✅ → #164 ✅ → #165 ⏭️ (완료)
- **#126 완료**: PR #168 (브랜치: `fix/#126-focustime-seconds`)
- **#164 완료**: PR #170 (브랜치: `fix/#164-task-focustime`, Stacked PR)
- **#165 스킵**: 현재 아키텍처에서 발생 불가능 (이슈 닫힘)
- **연관성**: 모두 `focustime.service.ts` 수정, DB 스키마 변경 포함
- **순서**:
  1. **#126**: `totalFocusMinutes` → `totalFocusSeconds` 변경 ✅
  2. **#164**: Task 집중 시간 서버 저장 (#126 스키마 활용) ✅
  3. **#165**: 트랜잭션/Lock 추가 ⏭️ 스킵 (발생 불가)

### 3. #166 ✅ → #167 ⏭️
- **#166 완료**: PR #176 (브랜치: `fix/#166-socket-response`, Stacked PR)
- **#167 스킵**: 에러 타입 구분의 실질적 가치 없음 (이슈 닫힘)

### 4. #159 (별도 진행)
- **브랜치**: `feat/#159-heartbeat`
- **연관성**: 연결 상태 감지 (FocusTime과 독립)
- **선행 조건**: 없음

### 5. #162 (별도 진행)
- **브랜치**: `feat/#162-daily-reset`
- **연관성**: 독립적인 신규 기능
- **선행 조건**: 포인트 시스템 완성 후 진행

---

## 참고: PR 스택 (2026-01-21 업데이트)

```
main ← PR #125, #134, #136 머지 완료 ✅
  └── PR #168 (fix/#126-focustime-seconds) - 리뷰 대기 중
        └── PR #170 (fix/#164-task-focustime) - 리뷰 대기 중 (Stacked PR)
              └── PR #176 (fix/#166-socket-response) - 리뷰 대기 중 (Stacked PR)
```

- #168: DB 집중 시간 초 단위 변경 (#126)
- #170: 개별 태스크 집중 시간 서버 저장 (#164) - #168 위에 Stacked PR
- #176: 소켓 이벤트 클라이언트 응답 추가 (#166) - #170 위에 Stacked PR
- 이후 작업은 #168 → #170 → #176 순서로 머지 후 진행
