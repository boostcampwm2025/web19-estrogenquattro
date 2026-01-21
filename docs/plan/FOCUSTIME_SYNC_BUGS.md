# FocusTime 동기화 버그 수정 계획

## 개요

FocusTime 기능의 동기화 관련 버그를 분석하고 수정하는 계획 문서

| 이슈 | 제목 | 관련 PR | 상태 |
|------|------|---------|------|
| #137 | 다른 플레이어 새로고침 시 집중시간이 0분으로 보임 | PR #125 | ✅ 수정 완료 (CI 통과) |
| #138 | 다른 플레이어의 집중시간이 실시간 동기화되지 않음 | 별도 PR 예정 | 원인 파악 완료 |
| #139 | 브라우저 탭 비활성화 시 타이머 부정확 | 별도 PR 예정 | 원인 파악 완료 (#138과 함께 해결) |
| #151 | 새로고침 시 로컬 플레이어 집중시간이 0분으로 표시됨 | 별도 PR 예정 | 원인 파악 완료 |

---

## 현재 코드 상태 (코드 검증 결과)

### 문제점 요약

| 위치 | 현재 상태 | 문제 |
|------|----------|------|
| `backend/player.gateway.ts` | `joined` 이벤트 emit 없음 | 로컬 플레이어 focusTime 복원 불가 |
| `frontend/SocketManager.ts` | `joined` 핸들러가 `roomId`만 처리 | focusTime 처리 로직 없음 |
| `frontend/useFocusTimeStore.ts` | `syncFromServer` 함수 없음 | 서버값 복원 로직 부재 |
| `frontend/RemotePlayer.ts` | `seconds++` 누적 방식 | 프레임 드랍/탭 비활성화 시 오차 |

### 현재 코드 상세

**backend/player.gateway.ts - `joined` 이벤트 없음:**
```typescript
// handleJoin 메서드에서 emit하는 이벤트들:
client.emit('players_synced', existingPlayers);  // 다른 플레이어들 정보
client.to(roomId).emit('player_joined', {...});  // 다른 사람들에게 내 정보 (focusTime 포함)
client.emit('github_state', roomState);          // GitHub 상태

// ❌ client.emit('joined', { roomId, focusTime }) 이벤트가 없음!
```

**frontend/SocketManager.ts:107-113 - focusTime 처리 없음:**
```typescript
socket.on("joined", (data: { roomId: string }) => {
  this.roomId = data.roomId;
  const currentPlayer = this.getPlayer();
  if (currentPlayer) {
    currentPlayer.setRoomId(data.roomId);
  }
  // ❌ focusTime 복원 로직 없음!
});
```

**frontend/useFocusTimeStore.ts - `syncFromServer` 없음:**
```typescript
export const useFocusTimeStore = create<FocusTimeStore>((set) => ({
  focusTime: 0,                    // 초기값 0
  isFocusTimerRunning: false,      // 초기값 false
  status: "RESTING",               // 초기값 RESTING

  // ❌ syncFromServer 함수가 아예 없음!
  // 새로고침 시 항상 초기값으로 시작
}));
```

**frontend/RemotePlayer.ts:50-58 - 누적 방식:**
```typescript
this.focusTimeTimer = this.scene.time.addEvent({
  delay: 1000,
  callback: () => {
    this.currentSessionSeconds++;  // ❌ 콜백 호출될 때마다 +1
    this.updateFocusTime(
      this.totalFocusMinutes * 60 + this.currentSessionSeconds,
    );
  },
  loop: true,
});
```

---

## 근본 원인 분석

### 원인 1: `seconds++` 누적 방식의 한계 (#138, #139)

**누적 방식의 동작:**
```typescript
let seconds = 0;
setInterval(() => {
  seconds++;        // 콜백이 호출될 때만 증가
  display(seconds);
}, 1000);
```

**문제 시나리오 1 - 프레임 드랍:**
```
실제 시간:  0초 → 1초 → 2초 → 3초 → 4초 → 5초
콜백 호출:   ✓     ✓     ✗     ✓     ✓     ✓
                        (스킵)
표시 시간:   1     2    (2)    3     4     5  ← 1초 손실!
```

**문제 시나리오 2 - 탭 비활성화 (60초간 백그라운드):**
```
t=0s:    집중 시작, seconds=0
t=10s:   탭 비활성화 (다른 탭으로 이동)
         ↓
         브라우저: 백그라운드 탭 타이머 쓰로틀링 (최대 1분 지연)
         ↓
t=70s:   탭 복귀
         표시: "20초"  ← 실제론 70초 경과!
```

**영향 범위:**
- `RemotePlayer`: Phaser `time.addEvent` (게임 프레임에 종속)
- `useFocusTimeStore`: `setInterval` (브라우저 쓰로틀링 영향)

### 원인 2: 서버 → 클라이언트 복원 로직 부재 (#151)

**문제 흐름:**
```
새로고침 발생
    ↓
useFocusTimeStore 초기화 → focusTime=0, status="RESTING"
    ↓
서버에 joining emit
    ↓
서버: 내 focusTime 조회 (status=FOCUSING, totalMinutes=10)
    ↓
서버: joined 이벤트 emit... ❌ 하지 않음! (코드에 없음)
    ↓
클라이언트: roomId만 받음 (focusTime 정보 없음)
    ↓
결과: 화면에 0분 표시 (서버에는 10분 저장되어 있음)
```

**3단계 문제:**
1. 백엔드가 `joined` 이벤트에 focusTime을 보내지 않음
2. 프론트엔드 `joined` 핸들러가 roomId만 처리
3. `useFocusTimeStore`에 `syncFromServer` 함수가 없음

---

## 해결 방안 비교: 경과 시간 기반 vs 하트비트

### 방식 개요

| 방식 | 개념 | 구현 |
|------|------|------|
| **경과 시간 기반** | 클라이언트 단일 시계로 `Date.now() - startTimestamp` 계산 | 서버에서 `currentSessionSeconds` 한 번 받고 로컬 계산 |
| **하트비트** | 서버가 주기적으로 현재 시간을 전송 | 서버에서 N초마다 모든 플레이어 focusTime broadcast |

### 경과 시간 기반 방식 (권장)

```typescript
// 클라이언트
const startTimestamp = Date.now() - (serverSeconds * 1000);

setInterval(() => {
  const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
  display(elapsed);
}, 1000);
```

| 장점 | 설명 |
|------|------|
| 네트워크 부하 없음 | 초기 1회만 서버 통신, 이후 로컬 계산 |
| 실시간성 | 1초마다 UI 업데이트 가능 |
| 오프라인 동작 | 네트워크 끊겨도 로컬에서 계속 증가 |
| 구현 단순 | 기존 코드에서 계산 방식만 변경 |

| 단점 | 설명 |
|------|------|
| 클라이언트 시계 의존 | 클라이언트 시계가 틀리면 오차 발생 |
| 드리프트 가능성 | 장시간 시 미세한 오차 누적 가능 |
| 시스템 시간 변경 | 사용자가 시스템 시간 변경 시 점프 발생 |

### 하트비트 동기화 방식

```typescript
// 서버 (5초마다)
setInterval(() => {
  room.players.forEach(player => {
    const elapsed = calculateElapsed(player);
    socket.to(roomId).emit('focus_time_sync', {
      userId: player.id,
      currentSessionSeconds: elapsed,
    });
  });
}, 5000);

// 클라이언트
socket.on('focus_time_sync', (data) => {
  remotePlayer.setFocusTime(data.totalFocusMinutes * 60 + data.currentSessionSeconds);
});
```

| 장점 | 설명 |
|------|------|
| 서버 권위 | 서버가 유일한 진실의 원천 (Single Source of Truth) |
| 클라이언트 시계 무관 | 클라이언트 시계가 틀려도 정확 |
| 자동 보정 | 오차 발생해도 다음 하트비트에서 자동 수정 |

| 단점 | 설명 |
|------|------|
| 네트워크 부하 | N명 × M초마다 브로드캐스트 (방 14명 × 5초 = 2.8msg/초) |
| 지연 표시 | 하트비트 간격만큼 업데이트 지연 |
| 점프 현상 | 5초 → 10초 → 15초 점프식 증가 (부자연스러움) |
| 네트워크 의존 | 연결 끊기면 시간 멈춤 |

### 하트비트 지연 표시 문제 상세

서버가 5초마다 현재 집중 시간을 브로드캐스트할 때:

```
실제 경과 시간:   0  1  2  3  4  5  6  7  8  9  10 ...
                 │  │  │  │  │  │  │  │  │  │  │
서버 전송:       ✓              ✓              ✓
                 │              │              │
클라이언트 표시: 0  0  0  0  0  5  5  5  5  5  10 ...
                              ↑
                        갑자기 0→5로 점프!
```

| 실제 시간 | 서버 전송 | 클라이언트 표시 | 오차 |
|-----------|----------|----------------|------|
| 0초 | ✓ (0초) | 0초 | 0초 |
| 1초 | - | 0초 | 1초 늦음 |
| 4초 | - | 0초 | 4초 늦음 |
| 5초 | ✓ (5초) | 5초 | 0초 |

하트비트 직전 순간(t=4.9초)에 최대 약 5초 오차 발생

### 정량 비교

| 항목 | 경과 시간 기반 | 하트비트 (5초) | 하이브리드 (30초) |
|------|----------|---------------|------------------|
| **네트워크 메시지/분** | 0 | 168 (14명×12회) | 28 (14명×2회) |
| **UI 업데이트 주기** | 1초 | 5초 | 1초 |
| **최대 표시 오차** | 클라이언트 시계 오차 | 5초 | 클라이언트 시계 오차 |
| **서버 부하** | 낮음 | 높음 | 낮음 |
| **구현 복잡도** | 낮음 | 중간 | 중간 |
| **오프라인 동작** | 가능 | 불가 | 가능 |

### 결론: 경과 시간 기반 방식 채택

| 이유 | 설명 |
|------|------|
| 기존 구조 유지 | 현재 `focused`, `players_synced` 이벤트에서 `currentSessionSeconds` 이미 전송 중 |
| 최소 변경 | RemotePlayer, useFocusTimeStore의 계산 로직만 수정 |
| 네트워크 효율 | 추가 통신 없음 |
| UX | 1초마다 부드러운 업데이트 |

---

## `Date.now()` vs `performance.now()` 분석

### 비교

| 항목 | `Date.now()` | `performance.now()` |
|------|-------------|---------------------|
| 기준 | Unix epoch (1970-01-01) | 페이지 로드 시점 |
| 단조성 | ❌ 시스템 시간 변경 시 점프/역행 가능 | ✅ monotonic (항상 증가) |
| 정밀도 | 밀리초 | 마이크로초 |
| 새로고침 시 | 값 유지 (epoch 기준) | 0으로 리셋 |

### `performance.now()` 사용 시 문제

```typescript
// 페이지 로드 시점 = 0
// 서버에서 currentSessionSeconds=120 받음
// startTimestamp = performance.now() - 120000 = -120000 (음수!)

// 새로고침하면 performance.now()가 0으로 리셋
// 서버와 기준점이 달라 역산 불가능
```

### 결론: `Date.now()` 사용 + 보완책

**기본:** `Date.now()` 사용 (서버와 동일한 epoch 기준)

**보완책 (선택적):**
1. `focused` 이벤트 수신 시마다 타임스탬프 재계산
2. Page Visibility API로 탭 복귀 시 즉시 갱신
3. 시스템 시간 급변 감지 시 서버 재동기화

```typescript
// 보완: focused 이벤트 수신 시 타임스탬프 재계산
socket.on('focused', (data) => {
  // 매번 서버 값으로 타임스탬프 재설정
  this.focusStartTimestamp = Date.now() - (data.currentSessionSeconds * 1000);
});
```

---

## 클라이언트 시간 사용이 안전한 이유

### 기존 문서의 경고

`docs/reference/FOCUS_TIME.md`에서는 클라이언트 시간 사용을 피하라고 명시:

> "클라이언트에서 `Date.now() - lastFocusStartTime`으로 계산하면 클라이언트 시계에 의존하게 되어 음수가 발생할 수 있음"
>
> "클라이언트 시계와 서버 시계가 다를 수 있으므로 시간 계산은 서버에서 수행한다"

### 이전 방식의 문제 (서버 시각 직접 사용)

```
클라이언트 Date.now() - 서버 lastFocusStartTime
          ↓
    서로 다른 시계 혼합 → 음수 발생 가능
```

**예시:**
- 서버 시계: 14:00:00 (집중 시작 시각)
- 클라이언트 시계: 13:58:00 (2분 느림)
- 계산: `13:58:30 - 14:00:00 = -90초` ❌

### 현재 제안 방식이 안전한 이유 (경과 시간 기반)

**핵심: 서버 시각(timestamp)이 아닌 경과 시간(seconds)을 받아서 클라이언트 내에서만 계산**

```typescript
// 1. 서버가 "경과 시간"을 계산해서 보내줌
// 서버: currentSessionSeconds = 120 (2분 경과)

// 2. 클라이언트에서 startTimestamp를 "역산"
const startTimestamp = Date.now() - (currentSessionSeconds * 1000);
// 클라이언트 시계 기준 "2분 전"으로 설정

// 3. 이후 모든 계산은 클라이언트 시계 내에서만 수행
elapsedSeconds = (Date.now() - startTimestamp) / 1000;
// 클라이언트 Date.now() - 클라이언트 startTimestamp
```

### 비교 요약

| 구분 | 이전 방식 (문제) | 현재 제안 방식 (안전) |
|------|-----------------|---------------------|
| 계산식 | `clientTime - serverTime` | `clientTime - clientTime` |
| 시계 혼합 | O (서로 다른 시계) | X (같은 시계) |
| 음수 가능성 | O | X |
| 서버 역할 | **시작 시각** 제공 | **경과 시간** 제공 |

**결론:** 서버는 "언제 시작했나(시각)"가 아니라 "지금까지 몇 초 지났나(경과 시간)"를 알려주고, 클라이언트는 그 값을 기준으로 자신의 시계 내에서 시작점을 역산하므로 시계 불일치 문제가 발생하지 않음.

---

## 해결 방안: 경과 시간 기반 계산

### 개념

타이머 콜백이 호출될 때마다 **클라이언트 단일 시계 내에서 시작 시각과 현재 시각의 차이**로 경과 시간을 계산

```typescript
// 누적 방식 (현재)
seconds++;

// 경과 시간 기반 방식 (개선)
const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
```

### 왜 경과 시간 기반 방식이 정확한가?

**콜백 지연 상황에서의 비교:**
```
실제 시간:     0s    1s    2s    3s    4s    5s
콜백 호출:     ✓     ✓     ✗     ✓     ✓     ✓
                          (스킵)

누적 방식:     1     2    (2)    3     4     5    ❌ 1초 손실
경과 시간 기반:     1     2    (2)    3     4     5    ✓ 정확
                          ↑
                    콜백 스킵되어도
                    다음 콜백에서 (3000ms - 0) / 1000 = 3초
```

**탭 비활성화 상황에서의 비교:**
```
실제 시간:     0s    10s   ────── 70s(탭 복귀) ──── 75s
콜백 호출:     ✓     ✓     (쓰로틀링: 몇 번만 호출)   ✓

누적 방식:     1    10           20                 25    ❌ 50초 손실
경과 시간 기반:     1    10           70                 75    ✓ 정확
```

### 시작 타임스탬프 역산

서버에서 `currentSessionSeconds=120`(이미 2분 경과)을 받았을 때:

```typescript
// 시작 시각 = 현재 시각 - 이미 경과한 시간
const startTimestamp = Date.now() - (120 * 1000);

// 이후 매 콜백에서:
const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
// → 즉시 120초, 다음에 121초, 122초...
```

---

## 기존 PR 현황

### PR #125: 다른 플레이어 집중 시간 표시 오류 수정

**상태:** ✅ CI 통과, 머지 대기

**변경 내용:**
- 서버에서 `currentSessionSeconds` 계산하여 전송
- `focused`, `players_synced` 이벤트에 `currentSessionSeconds` 추가
- `RemotePlayer`에서 서버 값 기반으로 1초마다 +1 증가
- `player_joined` 이벤트에 focusTime 정보 추가 (버그 #137 수정)
- 테스트 추가 (`socket-manager.spec.ts`)

**CI 관련 수정:**
- `frontend-ci.yml`: `pnpm test` → `pnpm test -- --run` (watch 모드 방지)
- `frontend-ci.yml`: backend 의존성 설치 추가
- `test/mocks/handlers/tasks.ts`: `@backend` import 제거, 로컬 변환 함수로 대체

---

## 버그 #137: 다른 플레이어 새로고침 시 집중시간 0분

### 현상
- 다른 플레이어가 새로고침하면, 나한테 그 플레이어의 집중시간이 0분으로 보임
- 잠시 후에야 실제 집중시간으로 동기화됨

### 원인 (코드 검증 완료)

**핵심 문제:** `player_joined` 이벤트에 focusTime 정보가 포함되지 않았음 (PR #125에서 수정됨)

### 해결 상태

✅ PR #125에서 수정 완료

---

## 버그 #138: 다른 플레이어 집중시간 실시간 동기화 안됨

### 현상
- 다른 플레이어의 집중시간이 표시는 되지만 1초마다 정확히 증가하지 않음
- 프레임 드랍 시 시간이 느리게 증가

### 원인 (코드 검증 완료)

**핵심 문제:** Phaser 타이머 + `seconds++` 누적 방식

```typescript
// RemotePlayer.ts:50-58 (현재 코드)
this.focusTimeTimer = this.scene.time.addEvent({
  delay: 1000,
  callback: () => {
    this.currentSessionSeconds++;  // ❌ 누적 방식
    this.updateFocusTime(this.totalFocusMinutes * 60 + this.currentSessionSeconds);
  },
  loop: true,
});
```

**문제점:**
1. Phaser `time.addEvent`는 게임 프레임에 종속
2. 프레임 드랍 시 콜백 지연 → 시간 오차 누적
3. `seconds++`는 콜백이 호출되지 않으면 증가하지 않음

### 해결 방안

**경과 시간 기반 계산으로 변경:**

```typescript
// RemotePlayer.ts 수정안
private focusStartTimestamp: number = 0;

setFocusState(isFocusing: boolean, options?: FocusTimeOptions) {
  // ⚠️ 기존 타이머 정리 (중복 방지)
  if (this.focusTimeTimer) {
    this.focusTimeTimer.destroy();
    this.focusTimeTimer = null;
  }

  if (isFocusing) {
    // 시작 타임스탬프 역산
    this.focusStartTimestamp = Date.now() - ((options?.currentSessionSeconds ?? 0) * 1000);
    this.totalFocusMinutes = options?.totalFocusMinutes ?? 0;

    this.focusTimeTimer = this.scene.time.addEvent({
      delay: 1000,
      callback: () => {
        // ✅ 매번 경과 시간 계산 (클라이언트 단일 시계)
        const elapsed = Math.floor((Date.now() - this.focusStartTimestamp) / 1000);
        this.updateFocusTime(this.totalFocusMinutes * 60 + elapsed);
      },
      loop: true,
    });
  }
}
```

### 작업 항목

- [x] 원인 파악: Phaser 타이머 + 누적 방식 문제 확인
- [ ] `RemotePlayer`에 `focusStartTimestamp` 속성 추가
- [ ] `setFocusState(true)` 시 시작 타임스탬프 역산
- [ ] 타이머 콜백에서 경과 시간 기반 계산
- [ ] `currentSessionSeconds++` 누적 방식 제거

---

## 버그 #139: 브라우저 탭 비활성화 시 타이머 부정확

### 현상
- 브라우저에서 다른 탭 사용 후 돌아오면 집중시간이 실제와 맞지 않음
- 로컬/원격 플레이어 모두 영향

### 원인 (코드 검증 완료)

**핵심 문제:** 브라우저 백그라운드 탭 쓰로틀링 + `seconds++` 누적 방식

- Chrome: 비활성 탭의 `setTimeout`/`setInterval`을 최소 1초, 최대 1분까지 지연
- Phaser 타이머도 동일하게 영향
- `seconds++` 방식은 콜백이 호출되지 않으면 시간이 증가하지 않음

### 해결 방안

**#138 해결책(경과 시간 기반)으로 자동 해결**

타이머 콜백이 지연되더라도 `Date.now() - startTimestamp`는 항상 정확한 경과 시간 반환

### 작업 항목

- [x] 원인 파악: 브라우저 쓰로틀링 + 누적 방식 문제 확인
- [ ] #138 해결책 적용 시 자동 해결
- [ ] (선택) Page Visibility API 핸들러 추가하여 탭 복귀 시 즉시 갱신

---

## 버그 #151: 새로고침 시 로컬 플레이어 집중시간 0분

### 현상
- 내가 새로고침하면 내 화면에서는 집중시간이 0분으로 표시됨
- 다른 플레이어들 화면에서는 실제 집중시간이 정상적으로 보임

### 원인 (코드 검증 완료)

**핵심 문제:** 서버 → 클라이언트 복원 로직이 3단계 모두 부재

**1단계: 백엔드가 `joined` 이벤트에 focusTime을 보내지 않음**
```typescript
// backend/player.gateway.ts - joined 이벤트 emit 자체가 없음!
client.emit('players_synced', existingPlayers);  // ✓
client.to(roomId).emit('player_joined', {...});  // ✓
client.emit('github_state', roomState);          // ✓
// ❌ client.emit('joined', { roomId, focusTime }) 없음!
```

**2단계: 프론트엔드 `joined` 핸들러가 roomId만 처리**
```typescript
// SocketManager.ts:107-113
socket.on("joined", (data: { roomId: string }) => {
  this.roomId = data.roomId;
  // ❌ focusTime 처리 없음!
});
```

**3단계: useFocusTimeStore에 `syncFromServer` 함수 없음**
```typescript
// useFocusTimeStore.ts - syncFromServer 함수가 아예 없음!
// 새로고침 시 항상 초기값(focusTime=0)으로 시작
```

### 해결 방안

**1. 백엔드: `joined` 이벤트에 focusTime 포함**
```typescript
// backend/player.gateway.ts handleJoin 메서드에 추가
client.emit('joined', {
  roomId,
  focusTime: {
    status: myFocusTime.status,
    totalFocusMinutes: myFocusTime.totalFocusMinutes,
    currentSessionSeconds: myCurrentSessionSeconds,
  },
});
```

**2. 프론트엔드: `joined` 핸들러에서 focusTime 처리**
```typescript
// SocketManager.ts
socket.on("joined", (data: { roomId: string; focusTime?: FocusTimeData }) => {
  this.roomId = data.roomId;
  if (data.focusTime) {
    useFocusTimeStore.getState().syncFromServer(data.focusTime);
  }
});
```

**3. useFocusTimeStore: `syncFromServer` + 경과 시간 기반 구현**
```typescript
// useFocusTimeStore.ts
interface FocusTimeStore {
  // 기존 필드...
  focusStartTimestamp: number | null;  // 추가
  focusTimerInterval: NodeJS.Timeout | null;  // 추가 (타이머 참조)
  syncFromServer: (data: FocusTimeData) => void;  // 추가
}

syncFromServer: (data) => {
  // ⚠️ 기존 타이머 정리 (중복 방지)
  const currentInterval = get().focusTimerInterval;
  if (currentInterval) {
    clearInterval(currentInterval);
  }

  const isFocusing = data.status === "FOCUSING";
  const totalSeconds = data.totalFocusMinutes * 60 +
    (isFocusing ? data.currentSessionSeconds : 0);

  // 시작 타임스탬프 역산
  const focusStartTimestamp = isFocusing
    ? Date.now() - (data.currentSessionSeconds * 1000)
    : null;

  set({
    status: data.status,
    isFocusTimerRunning: isFocusing,
    focusTime: totalSeconds,
    focusStartTimestamp,
    focusTimerInterval: null,
    error: null,
  });

  // FOCUSING 상태면 타이머 시작
  if (isFocusing) {
    get().startFocusTimer();
  }
}
```

### 작업 항목

- [x] 원인 파악: 3단계 복원 로직 부재 확인
- [ ] 백엔드: `joined` 이벤트에 focusTime 정보 추가
- [ ] 프론트엔드: `joined` 핸들러에서 focusTime 처리
- [ ] `useFocusTimeStore`에 `focusStartTimestamp` 상태 추가
- [ ] `useFocusTimeStore`에 `focusTimerInterval` 상태 추가 (타이머 중복 방지)
- [ ] `useFocusTimeStore`에 `syncFromServer` 함수 추가
- [ ] 경과 시간 기반 계산 방식 적용

---

## 수정 파일 목록 (Phase 2)

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/player/player.gateway.ts` | `joined` 이벤트에 focusTime 포함하여 emit |
| `frontend/src/game/managers/SocketManager.ts` | `joined` 핸들러에서 `syncFromServer` 호출 |
| `frontend/src/stores/useFocusTimeStore.ts` | `focusStartTimestamp` + `focusTimerInterval` + `syncFromServer` 추가, 경과 시간 기반 |
| `frontend/src/game/players/RemotePlayer.ts` | `focusStartTimestamp` 추가, 경과 시간 기반 계산 |
| `docs/api/SOCKET_EVENTS.md` | `joined` 이벤트 및 focusTime 관련 필드 추가 |

---

## 소켓 이벤트 명세 업데이트 필요

현재 `docs/api/SOCKET_EVENTS.md`와 실제 코드/계획 간 불일치:

| 이벤트 | 현재 명세 | 실제 코드 (PR #125) | Phase 2 계획 |
|--------|----------|-------------------|-------------|
| `joined` | ❌ 없음 | ❌ 없음 | ✅ 추가 예정 |
| `players_synced.currentSessionSeconds` | ❌ 없음 | ✅ 있음 | - |
| `player_joined.currentSessionSeconds` | ❌ 없음 | ✅ 있음 | - |
| `focused.currentSessionSeconds` | ❌ 없음 | ✅ 있음 | - |

**Phase 2 PR에서 `SOCKET_EVENTS.md` 업데이트 필요:**
1. `joined` 이벤트 추가
2. `players_synced`, `player_joined`, `focused` 이벤트에 `currentSessionSeconds` 필드 추가

---

## 구현 순서

### Phase 1: PR #125 - 버그 #137 해결 ✅ 완료

- [x] `player_joined` 이벤트에 focusTime 정보 추가
- [x] 프론트엔드 핸들러에서 focusTime 반영
- [x] 테스트 추가 (`socket-manager.spec.ts`)
- [x] CI 수정 (frontend-ci.yml, @backend 의존성 제거)

### Phase 2: 별도 PR - 버그 #138, #139, #151 해결 (예정)

**백엔드:**
1. `joined` 이벤트에 focusTime 정보 포함하여 emit

**프론트엔드 - RemotePlayer (원격 플레이어):**
2. `focusStartTimestamp` 속성 추가
3. `setFocusState()`에서 타임스탬프 역산
4. 타이머 콜백에서 경과 시간 기반 계산
5. `currentSessionSeconds++` 누적 방식 제거
6. 기존 타이머 정리 로직 확인

**프론트엔드 - useFocusTimeStore (로컬 플레이어):**
7. `focusStartTimestamp` 상태 추가
8. `focusTimerInterval` 상태 추가 (타이머 중복 방지)
9. `syncFromServer` 함수 추가 (기존 타이머 정리 후 시작)
10. 타이머에서 경과 시간 기반 계산 적용

**프론트엔드 - SocketManager:**
11. `joined` 핸들러에서 `syncFromServer` 호출

**문서:**
12. `docs/api/SOCKET_EVENTS.md` 업데이트

### Phase 3: 통합 테스트

1. ✅ 새로고침 후 집중시간 즉시 표시 확인 (#137)
2. 다른 플레이어 집중시간 실시간 동기화 확인 (#138)
3. 탭 비활성화 후 복귀 시 정확한 시간 표시 확인 (#139)
4. 새로고침 후 로컬 플레이어 집중시간 복원 확인 (#151)

---

## 테스트 케이스

### #137 테스트
- [x] 다른 플레이어 새로고침 → `player_joined`로 focusTime 정보 수신 → 즉시 집중시간 표시

### #138 테스트
- [ ] 플레이어 A 집중 시작 → 플레이어 B 화면에서 1초마다 정확히 시간 증가
- [ ] CPU 쓰로틀링 적용 후에도 시간이 정확히 표시

### #139 테스트
- [ ] 집중 중 다른 탭으로 1분 이동 → 복귀 시 정확한 시간 표시
- [ ] 다른 플레이어가 집중 중일 때 탭 이동 → 복귀 시 정확한 시간 표시

### #151 테스트
- [ ] 집중 중 새로고침 → 로컬 플레이어 집중시간이 서버 값으로 복원
- [ ] 복원 후 타이머가 계속 동작하여 1초마다 증가
- [ ] `syncFromServer` 중복 호출 시 타이머가 중첩되지 않음

---

## 참고 문서

- `docs/reference/FOCUS_TIME.md` - FocusTime 개요 및 시퀀스 다이어그램
- `docs/api/SOCKET_EVENTS.md` - 소켓 이벤트 명세
