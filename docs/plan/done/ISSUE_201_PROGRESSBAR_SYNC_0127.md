# Issue #201: 프로그레스바 동기화 불일치

> 2026-01-27 작성

## 선행 작업

- [ ] [PR #238](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/238) 머지 후 작업 예정

## 참조한 문서

- [GITHUB_POLLING.md](../api/GITHUB_POLLING.md): 폴링 및 github_event 브로드캐스트 흐름
- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md): github_event, github_state 이벤트 명세

## 이슈 요약

- **문제**: 같은 방 플레이어들이 프로그레스바 업데이트를 서로 다른 시점에 보게 됨
- **재현**: 플레이어 A, B가 같은 방 → GitHub 활동 발생 → A와 B가 다른 시점에 반영

---

## 코드 분석 결과

### 방별 상태 관리

프로그레스/기여도는 **방(room)별로 독립적으로 관리**됩니다:

```typescript
// RoomService: 방 관리
private rooms = new Map<string, RoomInfo>();  // room-1, room-2, room-3 (초기 3개)
// 용량: 14명, 꽉 차면 room-4, room-5... 생성

// GithubGateway: 방별 프로그레스/기여도
private roomStates = new Map<string, RoomGithubState>();
// 예: {
//   "room-1": { progress: 30, contributions: { "userA": 5 } },
//   "room-2": { progress: 50, contributions: { "userB": 10 } },
// }
```

- 각 방의 프로그레스는 서로 영향 없음
- `room-1`에서 활동 → `room-1`의 progress만 증가

### 동기화 메커니즘

프로그레스바 동기화는 **두 가지 별개의 메커니즘**으로 동작:

```
┌─────────────────────────────────────────────────────────────┐
│  1. 진입 시 (1회)                                            │
│     github_state → setProgress(현재값)                       │
│                                                             │
│  2. 이후 실시간                                              │
│     github_event → addProgress(증분)                         │
└─────────────────────────────────────────────────────────────┘
```

### 서버 (github.gateway.ts)

```typescript
// roomStates에서 프로그레스 계산
state.progress = (state.progress + progressIncrement) % 100;  // 범위: 0-99
state.contributions[username] = (state.contributions[username] || 0) + totalCount;

// 같은 방에 브로드캐스트 (증분만 전송, progress 값은 미포함)
server.to(roomId).emit('github_event', { username, pushCount, pullRequestCount });
```

### 클라이언트 (SocketManager.ts)

```typescript
// 진입 시 1회: 절대값으로 초기화
socket.on('github_state', (data) => {
  progressBarController.setProgress(data.progress);
});

// 이후 실시간: 증분으로 누적
socket.on('github_event', (data) => {
  const increment = data.pushCount * 2 + data.pullRequestCount * 5;
  progressBarController.addProgress(increment);  // 범위: 0-100
});
```

### 핵심 발견

| 항목 | 서버 | 클라이언트 |
|------|------|-----------|
| progress 범위 | 0-99 (`% 100`) | 0-100 (`Math.min`) |
| 계산 방식 | 서버에서 roomState 계산 | 클라이언트에서 독립 계산 |
| 전송 데이터 | 증분만 (pushCount, pullRequestCount) | - |

---

## 분석 결론

### ✅ 동기화가 잘 되는 경우

**프로그레스바가 채워지는 과정 자체는 동기화됨:**

```
[서버] github_event 브로드캐스트
         │
    ┌────┴────┐
    ▼         ▼
Client A   Client B
addProgress(2)  addProgress(2)
    │         │
    ▼         ▼
  32%        32%   ← 같은 값
```

- 같은 이벤트 → 같은 계산 → 같은 결과
- 진입 시 `github_state`로 초기값 동기화

### ❌ 동기화가 깨지는 경우

**맵 전환 후 신규 플레이어 진입 시 불일치 발생:**

```
1. 기존 플레이어들 progress = 98
2. github_event (+5) 발생
3. 클라이언트: 100% 도달 → 맵 전환 → progress = 0 (새 프로그레스바)
4. 서버: (98+5) % 100 = 3 (roomState 리셋 안 됨!)
5. 신규 플레이어 진입
   → github_state로 progress = 3 받음

결과:
- 기존 플레이어들: 0%
- 신규 플레이어: 3%  ← 불일치!
```

### 🔶 "다른 시점에 보임" 문제

이슈에서 언급된 "서로 다른 시점"은 **네트워크 레이턴시**로 추정:

- 같은 브로드캐스트가 각 클라이언트에 도달하는 시간이 미세하게 다름
- Tween 애니메이션 시작 시점 차이
- **값의 불일치가 아닌 시각적 타이밍 차이**

---

## 핵심 버그

### 맵 전환 시 서버 roomState 미초기화

```typescript
// 클라이언트: 맵 전환 시 새 프로그레스바 생성 (progress = 0)
this.progressBarController = createProgressBar(this, mapWidth);

// 서버: roomState.progress는 그대로 유지
// ⚠️ 리셋하는 코드가 없음!
```

---

## 해결 방향

### 방향 1: 맵 전환 시 서버 roomState 리셋 (권장)

```typescript
// 클라이언트 → 서버
socket.emit('map_switched', roomId);

// 서버 (GithubGateway)
public resetRoomProgress(roomId: string): void {
  const state = this.roomStates.get(roomId);
  if (state) {
    state.progress = 0;
    // contributions는 누적이므로 유지
  }
}
```

### 방향 2: targetProgress 전송

```typescript
// 서버
server.to(roomId).emit('github_event', {
  ...data,
  targetProgress: state.progress  // 최종 프로그레스 값
});

// 클라이언트
socket.on('github_event', (data) => {
  progressBar.setProgress(data.targetProgress);
});
```

### 방향 3: 주기적 상태 동기화

- 일정 간격으로 `github_state` 재전송하여 상태 보정

---

## 관련 파일

| 역할 | 파일 |
|------|------|
| 서버 progress 계산 | `backend/src/github/github.gateway.ts` |
| 방 진입 시 github_state 전송 | `backend/src/player/player.gateway.ts` |
| 클라이언트 이벤트 수신 | `frontend/src/game/managers/SocketManager.ts` |
| 프로그레스바 UI | `frontend/src/game/ui/createProgressBar.ts` |
| 맵 전환 트리거 | `frontend/src/game/scenes/MapScene.ts` |

## 브랜치

`fix/#201-progressbar-sync`

## 작업 순서

1. PR #238 머지 대기
2. 맵 전환 시 서버에 알리는 이벤트 추가 (`map_switched`)
3. 서버에서 roomState.progress 리셋 로직 구현
4. 테스트: 맵 전환 후 신규 플레이어 진입 시 동기화 확인
