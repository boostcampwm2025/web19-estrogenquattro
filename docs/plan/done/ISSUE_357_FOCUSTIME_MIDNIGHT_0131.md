# 이슈 #357: 자정 이후 집중시간이 잘못 표시되는 버그

## 문제 분석

### 재현 시나리오

```
1. 어제 23:00에 집중 시작
2. 자정이 넘어감 (스케줄러가 오늘 레코드 생성: totalFocusSeconds=0)
3. 오늘 01:00에 새로고침
4. 기대값: 1시간 (자정 이후 경과시간)
5. 실제값: 2시간 (어제 23:00부터의 총 경과시간)
```

### 근본 원인

자정 스케줄러(`focustime-midnight.scheduler.ts`)에서 `lastFocusStartTime`을 어제 값 그대로 유지:

```typescript
// backend/src/scheduler/focustime-midnight.scheduler.ts:41-50
const newRecords = yesterdayRecords.map((record) =>
  this.focusTimeRepository.create({
    totalFocusSeconds: 0,           // ✅ 초기화됨
    status: record.status,          // ✅ 유지됨
    lastFocusStartTime: record.lastFocusStartTime,  // ❌ 어제 시간 유지
    // ...
  }),
);
```

서버에서 `currentSessionSeconds` 계산 시:

```typescript
// player.gateway.ts:230-236, focustime.gateway.ts:51-55
const currentSessionSeconds = focusTime.lastFocusStartTime
  ? Math.floor((Date.now() - focusTime.lastFocusStartTime.getTime()) / 1000)
  : 0;
// = 오늘 01:00 - 어제 23:00 = 2시간 (잘못된 값)
```

### 영향 범위

| 위치 | 영향 |
|------|------|
| `focustime.gateway.ts:51-55` | `focusing` 이벤트 응답 |
| `player.gateway.ts:200-205` | `players_synced` 이벤트 (다른 플레이어 정보) |
| `player.gateway.ts:231-237` | `joined` 이벤트 (본인 정보) |
| `player.gateway.ts:247` | `player_joined` 이벤트 (다른 사람에게 내 정보) |

---

## 해결 방안

### 방안 1: 자정 스케줄러에서 `lastFocusStartTime`을 자정으로 리셋 (권장)

**장점:**
- 단일 지점 수정으로 모든 계산이 정확해짐
- 논리적으로 명확함 (오늘의 집중은 오늘 자정부터 시작)

**수정 위치:** `backend/src/scheduler/focustime-midnight.scheduler.ts`

```typescript
const newRecords = yesterdayRecords.map((record) => {
  const now = new Date();
  // 집중 중인 경우에만 lastFocusStartTime을 자정으로 설정
  const midnight = record.status === FocusStatus.FOCUSING
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    : record.lastFocusStartTime;

  return this.focusTimeRepository.create({
    totalFocusSeconds: 0,
    status: record.status,
    lastFocusStartTime: midnight,  // ✅ 자정으로 리셋
    // ...
  });
});
```

---

### 방안 2: `currentSessionSeconds` 계산 시 오늘 자정 이후 시간만 계산

**장점:**
- 기존 데이터를 건드리지 않음

**단점:**
- 모든 계산 위치에 로직 추가 필요 (4곳)
- 중복 로직 발생

**수정 위치:** 모든 `currentSessionSeconds` 계산 위치

```typescript
const getMidnightToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
};

const calculateCurrentSessionSeconds = (lastFocusStartTime: Date | null): number => {
  if (!lastFocusStartTime) return 0;

  const now = Date.now();
  const midnight = getMidnightToday().getTime();

  // lastFocusStartTime이 자정 이전이면 자정부터 계산
  const effectiveStart = Math.max(lastFocusStartTime.getTime(), midnight);

  return Math.floor((now - effectiveStart) / 1000);
};
```

---

### 추가 개선: 접속 중 클라이언트에게 자정 리셋 알림 (선택)

자정 스케줄러에서 접속 중인 클라이언트에게 `focus_time_reset` 이벤트 브로드캐스트:

**수정 위치:** `backend/src/scheduler/focustime-midnight.scheduler.ts`

```typescript
// WebSocketServer 주입 필요
@WebSocketServer()
server: Server;

@Cron('0 0 0 * * *', { timeZone: 'Asia/Seoul' })
async handleMidnight(): Promise<void> {
  // ... 기존 레코드 생성 로직 ...

  // 집중 중인 사용자들에게 리셋 알림
  const focusingRecords = newRecords.filter(r => r.status === FocusStatus.FOCUSING);
  for (const record of focusingRecords) {
    this.server.to(record.player.id.toString()).emit('focus_time_reset', {
      totalFocusSeconds: 0,
      currentSessionSeconds: 0,
    });
  }
}
```

**프론트엔드 처리:**

```typescript
// SocketManager에서
socket.on('focus_time_reset', (data) => {
  useFocusTimeStore.getState().syncFromServer({
    status: 'FOCUSING',  // 상태 유지
    totalFocusSeconds: data.totalFocusSeconds,
    currentSessionSeconds: data.currentSessionSeconds,
  });
});
```

---

## 권장 구현 순서

### 필수 작업

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | 자정 스케줄러에서 `lastFocusStartTime`을 자정으로 리셋 | `focustime-midnight.scheduler.ts` |
| 2 | 단위 테스트 추가 | `focustime-midnight.scheduler.spec.ts` |

### 선택 작업 (UX 개선)

| 순서 | 작업 | 파일 |
|------|------|------|
| 3 | 접속 중 클라이언트에 `focus_time_reset` 이벤트 브로드캐스트 | `focustime-midnight.scheduler.ts` |
| 4 | 프론트엔드에서 이벤트 처리 | `SocketManager.ts`, `useFocusTimeStore.ts` |

---

## 테스트 시나리오

### 단위 테스트

```typescript
describe('FocusTimeMidnightScheduler', () => {
  it('집중 중인 사용자의 레코드는 lastFocusStartTime이 자정으로 설정된다', async () => {
    // Given: 어제 23:00에 집중 시작한 레코드
    const yesterday2300 = new Date('2025-01-30T23:00:00');
    const yesterdayRecord = createFocusTimeRecord({
      status: 'FOCUSING',
      lastFocusStartTime: yesterday2300,
      totalFocusSeconds: 3600,
    });

    // When: 자정 스케줄러 실행
    await scheduler.handleMidnight();

    // Then: 오늘 레코드의 lastFocusStartTime이 자정
    const todayRecord = await repository.findOne({ where: { ... } });
    expect(todayRecord.lastFocusStartTime.getHours()).toBe(0);
    expect(todayRecord.lastFocusStartTime.getMinutes()).toBe(0);
    expect(todayRecord.totalFocusSeconds).toBe(0);
  });

  it('휴식 중인 사용자의 레코드는 lastFocusStartTime을 유지한다', async () => {
    // Given: 어제 22:00에 휴식 시작한 레코드
    const record = createFocusTimeRecord({
      status: 'RESTING',
      lastFocusStartTime: yesterday2200,
    });

    // When: 자정 스케줄러 실행
    await scheduler.handleMidnight();

    // Then: lastFocusStartTime 유지
    const todayRecord = await repository.findOne({ where: { ... } });
    expect(todayRecord.lastFocusStartTime).toEqual(yesterday2200);
  });
});
```

### E2E 테스트

```typescript
it('자정 이후 새로고침 시 오늘 집중시간만 표시된다', async () => {
  // Given: 어제 23:00부터 집중 중인 상태
  // When: 자정 스케줄러 실행 후 joining
  // Then: currentSessionSeconds가 자정 이후 경과시간만 반환
});
```

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `backend/src/scheduler/focustime-midnight.scheduler.ts` | 자정 스케줄러 (수정 대상) |
| `backend/src/focustime/focustime.gateway.ts` | 집중/휴식 이벤트 처리 |
| `backend/src/player/player.gateway.ts` | 입장 시 집중 상태 전달 |
| `docs/features/FOCUS_TIME_DETAIL.md` | 포커스타임 문서 (업데이트 필요) |

---

## 참고

- 이슈: https://github.com/boostcampwm2025/web19-estrogenquattro/issues/357
- 관련 문서: `docs/features/FOCUS_TIME_DETAIL.md` - 자정 초기화 스케줄러 섹션
