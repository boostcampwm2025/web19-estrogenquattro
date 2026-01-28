# Issue #241: 프로그레스바/기여도 전체 방 공유

> 2026-01-27 작성

## 참조한 문서

- [GITHUB_POLLING.md](../api/GITHUB_POLLING.md): roomStates 구조 및 github_event 브로드캐스트
- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md): github_event, github_state 이벤트 명세

## 이슈 요약

- **변경**: 방(room)별 개별 관리 → **전체 공유**
- **목적**: 모든 플레이어가 같은 게이지를 보고 함께 진행

---

## 현재 구조

```typescript
// github.gateway.ts
private roomStates = new Map<string, RoomGithubState>();

// 방별 독립 상태
// room-1: { progress: 30, contributions: { "userA": 5 } }
// room-2: { progress: 50, contributions: { "userB": 10 } }

// 방별 브로드캐스트
this.server.to(roomId).emit('github_event', githubEvent);
```

| 항목 | 현재 |
|------|------|
| 상태 저장 | `Map<roomId, State>` |
| progress | 방별 개별 |
| contributions | 방별 개별 |
| 브로드캐스트 | `server.to(roomId)` |

---

## 변경 후 구조

```typescript
// github.gateway.ts
private globalState: RoomGithubState = { progress: 0, contributions: {} };

// 전체 공유 상태
// { progress: 50, contributions: { "userA": 5, "userB": 10 } }

// 전체 브로드캐스트
this.server.emit('github_event', githubEvent);
```

| 항목 | 변경 후 |
|------|--------|
| 상태 저장 | 단일 `globalState` |
| progress | 전체 공유 |
| contributions | 전체 합산 |
| 브로드캐스트 | `server.emit()` |

---

## 변경 계획

### 1. GithubGateway 수정

```typescript
// 변경 전
private roomStates = new Map<string, RoomGithubState>();

public castGithubEventToRoom(githubEvent: GithubEventData, roomId: string) {
  this.updateRoomState(roomId, githubEvent);
  this.server.to(roomId).emit('github_event', githubEvent);
}

private updateRoomState(roomId: string, event: GithubEventData) {
  let state = this.roomStates.get(roomId);
  // ...
}

public getRoomState(roomId: string): RoomGithubState {
  return this.roomStates.get(roomId) || { progress: 0, contributions: {} };
}
```

```typescript
// 변경 후
private globalState: RoomGithubState = { progress: 0, contributions: {} };

public castGithubEvent(githubEvent: GithubEventData) {
  this.updateGlobalState(githubEvent);
  this.server.emit('github_event', githubEvent);  // 전체 브로드캐스트
}

private updateGlobalState(event: GithubEventData) {
  const progressIncrement =
    event.pushCount * PROGRESS_PER_COMMIT +
    event.pullRequestCount * PROGRESS_PER_PR;
  this.globalState.progress = (this.globalState.progress + progressIncrement) % 100;

  const totalCount = event.pushCount + event.pullRequestCount;
  this.globalState.contributions[event.username] =
    (this.globalState.contributions[event.username] || 0) + totalCount;
}

public getGlobalState(): RoomGithubState {
  return this.globalState;
}
```

### 2. GithubPollService 수정

```typescript
// 변경 전
this.githubGateway.castGithubEventToRoom(result.data!, schedule.roomId);

// 변경 후
this.githubGateway.castGithubEvent(result.data!);
```

### 3. PlayerGateway 수정

```typescript
// 변경 전
const roomState = this.githubGateway.getRoomState(roomId);
client.emit('github_state', roomState);

// 변경 후
const globalState = this.githubGateway.getGlobalState();
client.emit('github_state', globalState);
```

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/github.gateway.ts` | roomStates → globalState, 메서드명 변경 |
| `backend/src/github/github.poll-service.ts` | castGithubEventToRoom → castGithubEvent |
| `backend/src/player/player.gateway.ts` | getRoomState → getGlobalState |

---

## 관련 이슈 영향

### #201 프로그레스바 동기화

- **영향**: 맵 전환 시 리셋 로직 변경 필요
- **기존**: 방별 roomState.progress 리셋
- **변경**: globalState.progress 리셋 (전체 플레이어 영향)
- **고려사항**: 한 명이 맵 전환하면 모두 리셋? → 정책 결정 필요

### #214 서버 재시작 시 초기화

- **영향**: 영속화 대상이 roomStates → globalState로 단순화
- **장점**: 단일 상태만 저장/복원하면 됨

---

## 맵 전환 정책 (확정)

**A안 채택**: progress 100% 도달 시 **모든 플레이어** 동시 맵 전환

### 변경 흐름

```
현재:
  클라이언트 A가 100% 감지 → A만 맵 전환 (클라이언트 주도)

변경 후:
  서버가 100% 감지 → map_switch 전체 브로드캐스트 → 모든 클라이언트 맵 전환 (서버 주도)
```

### 4. 맵 전환 로직 수정

#### 서버 (GithubGateway)

```typescript
// 변경 후 - updateGlobalState에서 100% 감지
private updateGlobalState(event: GithubEventData) {
  const progressIncrement =
    event.pushCount * PROGRESS_PER_COMMIT +
    event.pullRequestCount * PROGRESS_PER_PR;

  this.globalState.progress += progressIncrement;

  // 100% 도달 시 맵 전환 브로드캐스트
  if (this.globalState.progress >= 100) {
    this.globalState.progress = 0;  // 리셋
    this.server.emit('map_switch');  // 전체 브로드캐스트
  }

  const totalCount = event.pushCount + event.pullRequestCount;
  this.globalState.contributions[event.username] =
    (this.globalState.contributions[event.username] || 0) + totalCount;
}
```

#### 클라이언트 (SocketManager)

```typescript
// 변경 전 - 클라이언트가 100% 감지
this.progressBarController.onProgressComplete = () => {
  this.mapManager.switchToNextMap(...);
};

// 변경 후 - 서버 이벤트로 맵 전환
socket.on('map_switch', () => {
  this.mapManager.switchToNextMap(...);
});
```

#### 클라이언트 (createProgressBar)

```typescript
// 변경 전 - 100% 도달 시 onProgressComplete 콜백 호출
if (progress >= 100) {
  controller.onProgressComplete?.();
}

// 변경 후 - 100% 도달해도 콜백 호출 안 함 (서버가 제어)
// onProgressComplete 콜백 제거
```

---

## 수정 대상 파일 (최종)

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/github.gateway.ts` | roomStates → globalState, 100% 감지 시 map_switch emit |
| `backend/src/github/github.poll-service.ts` | castGithubEventToRoom → castGithubEvent |
| `backend/src/player/player.gateway.ts` | getRoomState → getGlobalState |
| `frontend/src/game/managers/SocketManager.ts` | map_switch 이벤트 핸들러 추가 |
| `frontend/src/game/ui/createProgressBar.ts` | onProgressComplete 콜백 제거 |
| `frontend/src/game/scenes/MapScene.ts` | 맵 전환 트리거 변경 (콜백 → 소켓 이벤트) |

---

## 관련 이슈 영향

### #201 프로그레스바 동기화

- **해결됨**: 서버가 100% 감지 및 리셋을 제어하므로 동기화 문제 없음
- 모든 클라이언트가 동시에 `map_switch` 이벤트를 받음

### #214 서버 재시작 시 초기화

- **영향**: 영속화 대상이 roomStates → globalState로 단순화
- **장점**: 단일 상태만 저장/복원하면 됨

---

## 브랜치

`feat/#241-global-progress`

## 작업 순서

1. GithubGateway 수정 (globalState + 100% 감지)
2. GithubPollService 수정 (브로드캐스트)
3. PlayerGateway 수정 (초기 상태 전송)
4. SocketManager 수정 (map_switch 핸들러)
5. createProgressBar 수정 (onProgressComplete 제거)
6. MapScene 수정 (맵 전환 트리거 변경)
7. 테스트

## 테스트 계획

- [ ] 방 A에서 GitHub 활동 → 방 B에서도 프로그레스 증가 확인
- [ ] 신규 플레이어 진입 시 현재 globalState 수신 확인
- [ ] progress 100% 도달 시 **모든 클라이언트** 동시 맵 전환 확인
- [ ] 맵 전환 후 progress = 0 확인
