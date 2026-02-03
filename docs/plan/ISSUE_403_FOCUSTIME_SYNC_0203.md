# Issue #403: 새로고침 시 다른 사용자의 집중시간이 0분으로 표시되는 버그

## 관련 이슈

- #403: 새로고침 시 다른 사용자의 집중시간이 0분으로 표시되는 버그

---

## 버그 설명

### 증상

- 여러 사용자가 접속한 상태에서 한 사용자가 새로고침
- 새로고침한 사용자 화면에서 **다른 사람들의 집중시간이 0분으로 표시됨**
- 다른 사람이 다시 새로고침하면 정상적으로 돌아옴

### 재현 방법

1. 사용자 A, B가 동시에 접속 (A: 30분 집중 중, B: 10분 집중 중)
2. 사용자 A가 새로고침
3. A의 화면에서 B의 집중시간이 **0분**으로 표시됨
4. B가 새로고침하면 A의 집중시간은 정상 표시됨

### 버그 재현 상세 (2026-02-03 확인)

**핵심 포인트**: 기존 유저 → 새 유저는 정상, 새로고침한 유저 → 기존 유저는 버그

| 관점 | 대상 | 이벤트 | 결과 |
|------|------|--------|------|
| 새로고침한 유저 | 기존에 있던 유저들 | `players_synced` | ❌ **0분** (버그) |
| 기존에 있던 유저 | 새로 들어온 유저 | `player_joined` | ✅ 정상 표시 |

**테스트 데이터** (DB 삽입 완료):
- honki12345: 60분 (3600초)
- fpg12345: 30분 (1800초)

**수동 테스트 결과 - 수정 전** (2026-02-03):
- [x] 테스트 1: 새로고침 시 기존 유저 집중시간 → **0분 (버그 재현됨)**
- [x] 테스트 3: 빈 방 접속 → 에러 없음 ✅
- [x] 테스트 4: 집중 기록 없는 신규 유저 → 0분 정상 표시 ✅
- [x] 테스트 5: `player_joined` vs `players_synced` → 값 불일치 확인 (버그)

**수동 테스트 결과 - 수정 후** (예정):
- [ ] 테스트 1: 새로고침 시 기존 유저 집중시간 → 실제 값 표시되어야 함
- [ ] 테스트 3: 빈 방 접속 → 에러 없이 동작해야 함
- [ ] 테스트 4: 집중 기록 없는 신규 유저 → 0분 표시되어야 함
- [ ] 테스트 5: `player_joined` vs `players_synced` → 동일한 값이어야 함

---

## 원인 분석

### 문제 위치: `player.gateway.ts:235`

```typescript
// players_synced 이벤트에서 기존 플레이어 정보 전송 시
totalFocusSeconds: 0, // V2에서는 daily_focus_time 조회 생략 (필요시 추가)
```

### 발생 경위

`cb482a8` 커밋 (FocusTime 구조 개선)에서 V2 리팩토링을 진행하면서:

1. `findAllStatuses` 메서드가 더 이상 `totalFocusSeconds`를 반환하지 않도록 변경됨
2. `players_synced` 이벤트에서 `totalFocusSeconds`를 **임시로 0으로 하드코딩**
3. 주석에 "필요시 추가"라고 적었지만 실제로 추가되지 않은 채 배포됨

### 이벤트별 동작 비교

| 상황 | 이벤트 | totalFocusSeconds | 원인 |
|------|--------|-------------------|------|
| A가 새로고침 → B 정보 수신 | `players_synced` | **0 (하드코딩)** | 버그 ❌ |
| B가 새로 접속 → A가 B 수신 | `player_joined` | **실제 값** | 정상 ✅ |
| A가 joined → 자신 정보 | `joined` | **실제 값** | 정상 ✅ |

### 코드 비교

**`players_synced` (버그):**
```typescript
// line 215-240
const existingPlayers = Array.from(this.players.values())
  .filter(...)
  .map((p) => {
    return {
      ...p,
      totalFocusSeconds: 0, // ❌ 하드코딩
      currentSessionSeconds,
      ...
    };
  });
```

**`player_joined` (정상):**
```typescript
// line 259-273
const myFocusStatus = await this.focusTimeService.getPlayerFocusStatus(playerId);

client.to(roomId).emit('player_joined', {
  ...
  totalFocusSeconds: myFocusStatus.totalFocusSeconds, // ✅ 실제 값
  currentSessionSeconds: myFocusStatus.currentSessionSeconds,
  ...
});
```

---

## 배경 지식: 집중시간 데이터 모델

### daily_focus_time 테이블 정책

| 항목 | 설명 |
|------|------|
| 레코드 생성 | **플레이어당 하루 1행** (`findOrCreate` 패턴) |
| 레코드 생성 시점 | 첫 집중 종료(휴식) 시 생성 (집중한 적 없으면 레코드 없음) |
| 동시성 보호 | WriteLock + 트랜잭션으로 중복 생성 방지 |
| `createdAt` 용도 | **날짜 키** (실제 INSERT 시각 아님) |
| `createdAt` 값 | `getTodayKstRangeUtc().start` = KST 00:00의 UTC |

예시:
- KST 2월 3일 15:30에 레코드 생성 시
- `createdAt` = `2026-02-02T15:00:00.000Z` (KST 2월 3일 00:00의 UTC 표현)

### getTodayKstRangeUtc() 반환값

```typescript
// KST 2월 3일 기준
{
  start: '2026-02-02T15:00:00.000Z',  // KST 2월 3일 00:00:00.000
  end: '2026-02-03T14:59:59.999Z'     // KST 2월 3일 23:59:59.999
}
```

- `start`: KST 00:00:00.000 (inclusive)
- `end`: KST 23:59:59.999 (inclusive, **end-of-day**)
- BETWEEN 쿼리 사용 시 다음 날 레코드(15:00:00.000)는 포함되지 않음

### 집중시간 계산 정책

```
화면 표시 집중시간 = totalFocusSeconds + currentSessionSeconds
```

| 필드 | 설명 | 저장 위치 |
|------|------|----------|
| `totalFocusSeconds` | 이미 **정산된** 누적 시간 (휴식 시 반영) | DB (`daily_focus_time`) |
| `currentSessionSeconds` | 현재 **진행 중인** 세션 시간 | 메모리 계산 |

**중요**: `totalFocusSeconds`는 현재 세션을 **포함하지 않습니다**. 프론트엔드에서 두 값을 합산하여 표시합니다.

---

## 수정 방안

### 방안 1: 각 플레이어별 개별 조회 (채택)

`players_synced` 이벤트 전송 시 각 플레이어의 `totalFocusSeconds`를 `FocusTimeService`를 통해 개별 조회합니다.

```typescript
// player.gateway.ts handleJoin()

// 3. 새로운 플레이어에게 "현재 접속 중인 다른 사람들(같은 방)" 정보 전송
const existingPlayersRaw = Array.from(this.players.values()).filter(
  (p) => p.socketId !== client.id && p.roomId === roomId,
);

const existingPlayers = await Promise.all(
  existingPlayersRaw.map(async (p) => {
    const status = statusMap.get(p.playerId);

    // FocusTimeService를 통해 조회 (getPlayerFocusStatus 재사용)
    const focusStatus = await this.focusTimeService.getPlayerFocusStatus(
      p.playerId,
    );

    return {
      ...p,
      status: status?.isFocusing
        ? FocusStatus.FOCUSING
        : FocusStatus.RESTING,
      lastFocusStartTime: status?.lastFocusStartTime?.toISOString() ?? null,
      totalFocusSeconds: focusStatus.totalFocusSeconds, // ✅ 실제 값
      currentSessionSeconds: focusStatus.currentSessionSeconds, // ✅ 클램프 적용됨
      taskName: status?.isFocusing ? status?.taskName : null,
    };
  }),
);
```

**선택 이유**:
- 기존 `getPlayerFocusStatus()` 메서드를 재사용하여 새 코드 추가 최소화
- 현재 서비스 규모에서 N+1 문제는 큰 영향 없음
- `player_joined` 이벤트와 동일한 로직을 사용하여 일관성 보장

**참고**: 플레이어 수가 많아지면 방안 2(배치 조회)로 최적화 가능

---

## 작업 체크리스트

### PlayerGateway 수정

- [x] `handleJoin`에서 `getPlayerFocusStatus` 호출하여 `players_synced` 이벤트에 실제 `totalFocusSeconds` 전달

### 테스트

- [ ] 수동 테스트: 새로고침 시 다른 사용자 집중시간 표시 확인

---

## 테스트 계획

### 수동 테스트

#### 테스트 1: 새로고침 시 다른 사용자 집중시간 표시

1. 사용자 A 접속 → 집중 시작 (5분 대기)
2. 사용자 B 접속 → 집중 시작 (3분 대기)
3. 사용자 A 새로고침
4. **확인**: A 화면에서 B의 집중시간이 3분으로 표시됨 (0분 아님)
5. **확인**: A 화면에서 A의 집중시간도 5분으로 정상 표시됨

#### 테스트 2: 집중 중이 아닌 사용자 표시

1. 사용자 A 접속 → 집중 시작 → 휴식 (총 10분 집중)
2. 사용자 B 접속
3. 사용자 B 새로고침
4. **확인**: B 화면에서 A의 오늘 누적 집중시간이 10분으로 표시됨

#### 테스트 3: 빈 방 접속

1. 새 방에 사용자 A 접속
2. **확인**: `players_synced` 이벤트에 빈 배열 전달 (에러 없음)

#### 테스트 4: 오늘 처음 접속한 사용자

1. 사용자 A 접속 (오늘 집중 기록 없음)
2. 사용자 B 접속 후 새로고침
3. **확인**: B 화면에서 A의 집중시간이 0분으로 표시됨 (정상)

#### 테스트 5: player_joined와 players_synced 값 일치

1. 사용자 A 접속 → 집중 시작 (5분 대기) → 휴식 → 다시 집중 (2분)
2. 사용자 B 접속 → `player_joined`로 A의 정보 확인 (totalFocusSeconds: 300)
3. 사용자 B 새로고침 → `players_synced`로 A의 정보 확인
4. **확인**: `players_synced`의 A 정보가 `player_joined`와 동일

---

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/player/player.gateway.ts` | `players_synced` 이벤트에서 `getPlayerFocusStatus()`를 호출하여 실제 `totalFocusSeconds` 전달 |

---

## 참고: 지정된 커밋 분석 결과

사용자가 지정한 세 커밋은 이 버그의 직접적인 원인이 아닙니다:

| 커밋 | 내용 | 버그 관련성 |
|------|------|------------|
| `010dbdb` | map_switch 디바운스 | ❌ 무관 |
| `1f34bc3` | contributions 포인트 기준 | ❌ 무관 |
| `9f22c44` | WASD/활동탭 제거 | ❌ 무관 |

실제 원인은 이전 커밋 `cb482a8` (FocusTime 구조 개선)에서 발생했습니다.

---

## 발견 경위

- **발견일**: 2026-02-03
- **원인 커밋**: `cb482a8` (2026-02-02)
- **원인 코드**: `player.gateway.ts:235` - `totalFocusSeconds: 0` 하드코딩
