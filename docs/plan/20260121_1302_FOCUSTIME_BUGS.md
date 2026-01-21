# FocusTime 미해결 버그

**최종 업데이트:** 2026-01-21

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
| #164 | 개별 태스크 집중 시간이 서버에 저장되지 않음 | ❌ 미해결 |
| #165 | FocusTime Race Condition - 트랜잭션 미사용 | ❌ 미해결 |
| #166 | FocusTime 소켓 이벤트 클라이언트 응답 누락 | ❌ 미해결 |
| #167 | FocusTime Disconnect 시 에러 처리 미흡 | ❌ 미해결 |

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

## #164: 개별 태스크 집중 시간이 서버에 저장되지 않음

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

- [ ] `focusing` 이벤트에 `taskId` 추가
- [ ] `DailyFocusTime` 엔티티에 `currentTaskId` 필드 추가
- [ ] `startFocusing`에서 `currentTaskId` 저장
- [ ] `startResting`에서 해당 Task의 집중 시간 업데이트
- [ ] 프론트엔드에서 `focusing` 이벤트 전송 시 `taskId` 포함
- [ ] 새로고침 시 Task 시간 서버에서 복원 확인
- [ ] 테스트 추가

### 관련 이슈

- #126: Task 테이블도 `totalFocusMinutes` → `totalFocusSeconds` 변경 필요

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

## #165: FocusTime Race Condition - 트랜잭션 미사용

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

- [ ] `startFocusing`에 트랜잭션 또는 Lock 추가
- [ ] `startResting`에 트랜잭션 또는 Lock 추가
- [ ] 이미 같은 상태면 무시하는 로직 추가
- [ ] 테스트 추가

---

## #166: FocusTime 소켓 이벤트 클라이언트 응답 누락

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

- [ ] `handleFocusing`에 try-catch + return 응답 추가
- [ ] `handleResting`에 try-catch + return 응답 추가
- [ ] `handleFocusTaskUpdating`에 try-catch + return 응답 추가
- [ ] 프론트엔드 응답 처리 (선택)
- [ ] 테스트 추가

### 참고

현재는 클라이언트가 **낙관적 업데이트(optimistic update)**를 하고 있어서 대부분 동작하지만, 에러 발생 시 **상태 불일치**가 생길 수 있음

---

## #167: FocusTime Disconnect 시 에러 처리 미흡

### 현상

Disconnect 시 `startResting()` 호출이 실패해도 로깅만 하고 무시 → 집중 시간 손실 가능

### 시나리오

```
1. 사용자가 집중 중 (FOCUSING, 10분 경과)
2. 브라우저 강제 종료 (disconnect)
3. 서버: startResting() 호출 → DB 에러 발생
4. 서버: 에러 로깅만 하고 종료
5. DB에 10분이 누적되지 않음 ❌
```

### 현재 코드

```typescript
// focustime.gateway.ts
async handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
  try {
    await this.focusTimeService.startResting(user.playerId);
  } catch (error) {
    this.logger.error(`Failed to set RESTING on disconnect: ${error.message}`);
    // 에러 로깅만 하고 끝 ← 문제점
  }
}
```

### 해결 방안

```typescript
async handleDisconnect(@ConnectedSocket() client: AuthenticatedSocket) {
  const user = client.data.user;
  if (!user) return;

  try {
    await this.focusTimeService.startResting(user.playerId);
    this.logger.log(`Player ${user.playerId} disconnected, set to RESTING`);
  } catch (error) {
    // 이미 RESTING이면 정상 케이스로 처리
    if (error instanceof NotFoundException) {
      this.logger.warn(`Player ${user.playerId} already RESTING or not found`);
      return;
    }

    // 그 외 에러는 심각한 문제
    this.logger.error(`Critical: Failed to save focus time on disconnect`, error);
    // TODO: 재시도 로직 또는 알림
  }
}
```

### 주의: Disconnect vs Resting

| 상황 | 이벤트 | 사용자 상태 |
|------|--------|------------|
| 집중 → 휴식 전환 | `rested` 브로드캐스트 | 방에 **남아있음** |
| 브라우저 종료 | `player_left` 브로드캐스트 | 방에서 **나감** |

Disconnect 시에는 `rested`가 아니라 `player_left` 이벤트가 PlayerGateway에서 처리됨

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/focustime/focustime.gateway.ts` | 에러 타입별 처리 |

### 체크리스트

- [ ] 에러 타입별 처리 (NotFoundException은 무시)
- [ ] 심각한 에러는 별도 로깅/알림
- [ ] 테스트 추가

---

## 작업 순서

### 1. #124 ✅ (완료)
- PR #134에 커밋 추가
- 프론트엔드만 수정

### 2. #126 ✅ → #164 → #165 (순차 진행)
- **#126 완료**: PR #168 (브랜치: `fix/#126-focustime-seconds`)
- **연관성**: 모두 `focustime.service.ts` 수정, DB 스키마 변경 포함
- **순서**:
  1. **#126**: `totalFocusMinutes` → `totalFocusSeconds` 변경 ✅
  2. **#164**: Task 집중 시간 서버 저장 (#126 스키마 활용)
  3. **#165**: 트랜잭션/Lock 추가 (서비스 로직 안정화)

### 3. #166 → #167 (순차 진행)
- **브랜치**: `fix/#166-socket-response` (base: 2단계 PR)
- **연관성**: 모두 `focustime.gateway.ts` 수정
- **순서**:
  1. **#166**: 소켓 이벤트 클라이언트 응답 추가
  2. **#167**: Disconnect 에러 처리 개선

### 4. #162 (별도 진행)
- **브랜치**: `feat/#162-daily-reset`
- **연관성**: 독립적인 신규 기능
- **선행 조건**: 포인트 시스템 완성 후 진행

---

## 참고: PR 스택 (2026-01-21 업데이트)

```
main ← PR #125, #134, #136 머지 완료 ✅
  └── PR #168 (fix/#126-focustime-seconds) - 리뷰 대기 중
```

- #168: DB 집중 시간 초 단위 변경 (#126)
- 이후 작업은 #168 머지 후 main에서 브랜치 생성
