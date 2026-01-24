# FocusTime 버그 수정 계획

## 개요

FocusTime 관련 3건의 버그를 수정하는 계획 문서

| 이슈 | 제목 | 상태 |
|------|------|------|
| #120 | 다른 플레이어의 집중 시간 표시 오류 | ✅ 완료 |
| #121 | 새로고침 시 로컬 플레이어 집중 시간 초기화 안 됨 | ✅ 완료 |
| #122 | 집중 중 Task 이름 변경 시 화면에 반영되지 않음 | ✅ 완료 |

## 진행 상황

### 완료된 작업

**#120 (PR #133 - fix/#120-focustime-bugs)**
- [x] 백엔드: `focused`, `players_synced`에 `currentSessionSeconds` 추가
- [x] 프론트엔드: RemotePlayer에서 서버 `currentSessionSeconds` 사용
- [x] 프론트엔드: SocketManager 핸들러 수정
- [x] 테스트: SocketManager 테스트 업데이트
- [x] 문서: FOCUS_TIME.md 시퀀스 다이어그램 추가

**#121 (PR #134 - fix/#121-focustime-refresh)**
- [x] 백엔드: `joined` 이벤트에 focusTime 포함
- [x] 프론트엔드: `syncFromServer` 액션 추가
- [x] 프론트엔드: joined 핸들러에서 `syncFromServer` 호출
- [x] 테스트: 백엔드 E2E 소켓 테스트 추가 (`focustime.e2e-spec.ts`)

**#122 (PR #136 - fix/#122-focus-task-updated)**
- [x] 백엔드: `focus_task_updated` 핸들러 추가
- [x] 프론트엔드: `editTask`에서 `focus_task_updated` 전송
- [x] 프론트엔드: SocketManager에 `focus_task_updated` 핸들러 추가
- [x] 테스트: FakeSocket 테스트 추가 (`socket-manager.spec.ts`)
- [x] 문서: SOCKET_EVENTS.md, PR_CONVENTION.md 업데이트

## 핵심 설계 결정: 서버 기준 시간 계산

### 문제점

클라이언트에서 `Date.now() - lastFocusStartTime`으로 경과 시간을 계산하면:
- 클라이언트 시계가 서버보다 느릴 경우 **음수** 발생
- 클라이언트마다 시간이 다르게 표시될 수 있음

### 해결 방식

**서버에서 `currentSessionSeconds`를 계산하여 전송:**

```typescript
// 서버
currentSessionSeconds = Math.floor((Date.now() - lastFocusStartTime.getTime()) / 1000)

// 클라이언트
let seconds = currentSessionSeconds;  // 서버 값으로 시작
setInterval(() => seconds++, 1000);   // 1초마다 +1 증가
```

이 방식의 장점:
- 클라이언트 시계에 의존하지 않음
- 음수 불가능
- 모든 클라이언트가 동일한 시간 표시

## 작업 흐름

각 버그마다 다음 순서로 진행:

1. **버그 수정** - 코드 변경
2. **회귀 테스트 추가** - 수정 검증 테스트 작성
3. **CI 검사** - `pnpm test` 및 `pnpm lint` 통과 확인
4. **문서 업데이트** - SOCKET_EVENTS.md 등 관련 문서 갱신

---

## 버그 1: #120 - 다른 플레이어 집중 시간 표시 오류

### 원인 분석

- 클라이언트에서 `Date.now() - lastFocusStartTime`으로 계산
- 클라이언트 시계가 서버보다 느리면 음수 발생
- 시간대(Timezone) 파싱 문제 가능성

### 수정 내용

**backend/src/focustime/focustime.gateway.ts**

`focused` 이벤트에 `currentSessionSeconds` 추가:

```typescript
client.to(roomId).emit('focused', {
  userId: client.id,
  username: focusTime.player.nickname,
  status: focusTime.status,
  lastFocusStartTime: focusTime.lastFocusStartTime?.toISOString() ?? null,
  totalFocusMinutes: focusTime.totalFocusMinutes,
  taskName: data?.taskName,
  // 추가: 서버에서 계산한 현재 세션 경과 시간
  currentSessionSeconds: focusTime.lastFocusStartTime
    ? Math.floor((Date.now() - focusTime.lastFocusStartTime.getTime()) / 1000)
    : 0,
});
```

**backend/src/player/player.gateway.ts**

`players_synced`에 `currentSessionSeconds` 추가:

```typescript
.map((p) => {
  const status = statusMap.get(p.playerId);
  return {
    ...p,
    status: status?.status ?? 'RESTING',
    lastFocusStartTime: status?.lastFocusStartTime?.toISOString() ?? null,
    totalFocusMinutes: status?.totalFocusMinutes ?? 0,
    // 추가: 서버에서 계산한 현재 세션 경과 시간
    currentSessionSeconds: (status?.status === 'FOCUSING' && status?.lastFocusStartTime)
      ? Math.floor((Date.now() - status.lastFocusStartTime.getTime()) / 1000)
      : 0,
  };
});
```

**frontend/src/game/players/RemotePlayer.ts**

`setFocusState`에서 서버가 계산한 `currentSessionSeconds` 사용:

```typescript
interface FocusTimeOptions {
  taskName?: string;
  lastFocusStartTime?: string | null;
  totalFocusMinutes?: number;
  currentSessionSeconds?: number;  // 추가
}

setFocusState(isFocusing: boolean, options?: FocusTimeOptions) {
  this.isFocusing = isFocusing;
  this.totalFocusMinutes = options?.totalFocusMinutes ?? 0;

  // 기존 타이머 정리
  if (this.focusTimeTimer) {
    this.focusTimeTimer.destroy();
    this.focusTimeTimer = null;
  }

  if (isFocusing) {
    // 서버에서 받은 경과 시간으로 시작 (클라이언트 시계 사용 안 함)
    let currentSeconds = options?.currentSessionSeconds ?? 0;

    // 초기 표시
    this.updateFocusTime(this.totalFocusMinutes * 60 + currentSeconds);

    // 1초마다 +1 증가
    this.focusTimeTimer = this.scene.time.addEvent({
      delay: 1000,
      callback: () => {
        currentSeconds++;
        this.updateFocusTime(this.totalFocusMinutes * 60 + currentSeconds);
      },
      loop: true,
    });
  } else {
    // 휴식 상태: 누적 시간만 표시
    this.updateFocusTime(this.totalFocusMinutes * 60);
  }

  this.updateTaskBubble({ isFocusing, taskName: options?.taskName });
}
```

**frontend/src/game/managers/SocketManager.ts**

`focused` 이벤트 핸들러에서 `currentSessionSeconds` 전달:

```typescript
socket.on('focused', (data: {
  userId: string;
  status: string;
  taskName?: string;
  lastFocusStartTime?: string;
  totalFocusMinutes?: number;
  currentSessionSeconds?: number;  // 추가
}) => {
  if (data.status !== 'FOCUSING') return;
  const remotePlayer = this.otherPlayers.get(data.userId);
  if (remotePlayer) {
    remotePlayer.setFocusState(true, {
      taskName: data.taskName,
      lastFocusStartTime: data.lastFocusStartTime,
      totalFocusMinutes: data.totalFocusMinutes ?? 0,
      currentSessionSeconds: data.currentSessionSeconds ?? 0,  // 추가
    });
  }
});
```

`addRemotePlayer`에서도 `currentSessionSeconds` 전달:

```typescript
remotePlayer.setFocusState(data.status === 'FOCUSING', {
  lastFocusStartTime: data.lastFocusStartTime ?? undefined,
  totalFocusMinutes: data.totalFocusMinutes ?? 0,
  currentSessionSeconds: data.currentSessionSeconds ?? 0,  // 추가
});
```

### 회귀 테스트

**backend/src/focustime/focustime.gateway.spec.ts**

```typescript
describe('FocusTimeGateway', () => {
  describe('handleFocusing', () => {
    it('focused 이벤트에 currentSessionSeconds가 포함된다', async () => {
      // Given: 인증된 클라이언트와 방
      // When: focusing 이벤트 발생
      // Then: emit된 데이터에 currentSessionSeconds가 0 이상의 정수
    });
  });
});
```

**frontend/test/integration/focus.socket.spec.ts**

```typescript
it('focused 이벤트의 currentSessionSeconds로 시간을 초기화한다', () => {
  // Given: RemotePlayer가 존재
  // When: currentSessionSeconds: 120을 가진 focused 이벤트 수신
  // Then: setFocusState가 currentSessionSeconds: 120으로 호출됨
});

it('1초마다 currentSessionSeconds가 증가한다', () => {
  // Given: FOCUSING 상태의 RemotePlayer
  // When: 3초 경과
  // Then: 표시 시간이 3초 증가
});
```

### 문서 업데이트

**docs/api/SOCKET_EVENTS.md** - `focused` 이벤트 스키마 업데이트:

```typescript
socket.on('focused', (data: {
  userId: string,
  username: string,
  status: 'FOCUSING',
  lastFocusStartTime: string | null,
  totalFocusMinutes: number,
  currentSessionSeconds: number,  // 서버가 계산한 현재 세션 경과 시간 (초)
  taskName?: string
}) => {});
```

---

## 버그 2: #121 - 새로고침 시 로컬 플레이어 집중 시간 초기화 안 됨

### 원인 분석

- `players_synced` 이벤트는 **다른 플레이어**의 상태만 동기화
- 로컬 플레이어의 FocusTime 상태를 서버에서 가져오는 로직이 없음
- 새로고침 시 `useFocusTimeStore`가 초기값(0)으로 리셋됨

### 수정 내용

**backend/src/player/player.gateway.ts**

`joined` 이벤트 응답에 FocusTime 상태 포함:

```typescript
// joining 핸들러에서 focusTime 조회 후
const myFocusTime = await this.focusTimeService.findOrCreate(player);

// joined 이벤트 emit 수정
client.emit('joined', {
  roomId: roomId,
  focusTime: {
    status: myFocusTime.status,
    totalFocusMinutes: myFocusTime.totalFocusMinutes,
    currentSessionSeconds: (myFocusTime.status === 'FOCUSING' && myFocusTime.lastFocusStartTime)
      ? Math.floor((Date.now() - myFocusTime.lastFocusStartTime.getTime()) / 1000)
      : 0,
  },
});
```

**frontend/src/stores/useFocusTimeStore.ts**

`syncFromServer` 액션 추가:

```typescript
interface FocusTimeStore {
  // 기존 필드...

  syncFromServer: (data: {
    status: 'FOCUSING' | 'RESTING';
    totalFocusMinutes: number;
    currentSessionSeconds: number;
  }) => void;
}

syncFromServer: (data) => {
  const isFocusing = data.status === 'FOCUSING';
  const focusTime = data.totalFocusMinutes * 60 + data.currentSessionSeconds;

  set({
    status: data.status,
    isFocusTimerRunning: isFocusing,
    focusTime: focusTime,
  });
}
```

**frontend/src/game/managers/SocketManager.ts**

`joined` 이벤트 핸들러 수정:

```typescript
socket.on('joined', (data: {
  roomId: string;
  focusTime?: {
    status: 'FOCUSING' | 'RESTING';
    totalFocusMinutes: number;
    currentSessionSeconds: number;
  };
}) => {
  this.roomId = data.roomId;
  const currentPlayer = this.getPlayer();
  if (currentPlayer) {
    currentPlayer.setRoomId(data.roomId);
  }

  // FocusTime 상태 동기화
  if (data.focusTime) {
    useFocusTimeStore.getState().syncFromServer(data.focusTime);
  }
});
```

### 회귀 테스트

**backend/src/player/player.gateway.spec.ts**

```typescript
describe('PlayerGateway', () => {
  describe('handleJoin', () => {
    it('joined 이벤트에 focusTime이 포함된다', async () => {
      // Given: 인증된 클라이언트
      // When: joining 이벤트 발생
      // Then: joined 이벤트에 focusTime { status, totalFocusMinutes, currentSessionSeconds } 포함
    });

    it('FOCUSING 상태일 때 currentSessionSeconds가 올바르게 계산된다', async () => {
      // Given: 5분 전 집중 시작한 플레이어
      // When: joining 이벤트 발생
      // Then: currentSessionSeconds가 약 300
    });
  });
});
```

**frontend/test/unit/useFocusTimeStore.spec.ts**

```typescript
describe('useFocusTimeStore', () => {
  describe('syncFromServer', () => {
    it('RESTING 상태를 올바르게 동기화한다', () => {
      // Given: 초기 상태
      // When: { status: 'RESTING', totalFocusMinutes: 10, currentSessionSeconds: 0 }
      // Then: focusTime = 600, isFocusTimerRunning = false
    });

    it('FOCUSING 상태를 올바르게 동기화한다', () => {
      // Given: 초기 상태
      // When: { status: 'FOCUSING', totalFocusMinutes: 10, currentSessionSeconds: 120 }
      // Then: focusTime = 720, isFocusTimerRunning = true
    });
  });
});
```

### 문서 업데이트

**docs/api/SOCKET_EVENTS.md** - `joined` 이벤트 추가:

```markdown
### joined

방 입장 완료 응답 (joining 요청 후 수신)

```typescript
socket.on('joined', (data: {
  roomId: string,
  focusTime: {
    status: 'FOCUSING' | 'RESTING',
    totalFocusMinutes: number,
    currentSessionSeconds: number  // 서버가 계산한 현재 세션 경과 시간 (초)
  }
}) => {
  // 방 ID 저장
  // FocusTime 상태 동기화
});
```
```

---

## 버그 3: #122 - 집중 중 Task 이름 변경 시 화면에 반영되지 않음

### 원인 분석

- Task 이름 변경 시 REST API만 호출
- 다른 플레이어에게 소켓으로 브로드캐스트하지 않음

### 중요: focusing 이벤트 재사용 문제

**문제점**: `focusing` 이벤트를 재전송하면 서버에서 `startFocusing()`이 호출되어 `lastFocusStartTime`이 갱신됨
- 이로 인해 집중 세션이 리셋되고 타이머가 초기화됨

**해결 방안**: 새 이벤트 `focus_task_updated` 추가
- 서버에서 taskName만 브로드캐스트
- `lastFocusStartTime`은 건드리지 않음

### 수정 내용

**backend/src/focustime/focustime.gateway.ts**

`focus_task_updated` 이벤트 핸들러 추가:

```typescript
@SubscribeMessage('focus_task_updated')
async handleFocusTaskUpdated(
  @ConnectedSocket() client: AuthenticatedSocket,
  @MessageBody() data: { taskName: string },
) {
  const user = client.data.user;

  const rooms = Array.from(client.rooms);
  const roomId = rooms.find((room) => room !== client.id);

  if (roomId) {
    // taskName만 브로드캐스트 (startFocusing 호출 없음)
    client.to(roomId).emit('focus_task_updated', {
      userId: client.id,
      username: user.username,
      taskName: data.taskName,
    });

    this.logger.log(
      `User ${user.username} updated focus task to: ${data.taskName}`,
    );
  }
}
```

**frontend/src/stores/useTasksStore.ts**

`editTask`에서 집중 중인 Task 수정 시 `focus_task_updated` 이벤트 전송:

```typescript
editTask: async (id: number, newText: string) => {
  // 기존 유효성 검사...

  try {
    await taskApi.updateTask(id, trimmedText);

    // 낙관적 업데이트...

    // 집중 중인 Task 이름 변경 시 브로드캐스트
    const { tasks } = get();
    const editedTask = tasks.find((t) => t.id === id);

    if (editedTask?.isRunning) {
      const { status } = useFocusTimeStore.getState();
      if (status === 'FOCUSING') {
        const socket = getSocket();
        if (socket?.connected) {
          socket.emit('focus_task_updated', { taskName: trimmedText });
        }
      }
    }
  } catch (error) {
    // 기존 에러 처리...
  }
}
```

**frontend/src/game/managers/SocketManager.ts**

`focus_task_updated` 이벤트 핸들러 추가:

```typescript
socket.on('focus_task_updated', (data: {
  userId: string;
  username: string;
  taskName: string;
}) => {
  const remotePlayer = this.otherPlayers.get(data.userId);
  if (remotePlayer) {
    remotePlayer.updateTaskBubble({ isFocusing: true, taskName: data.taskName });
  }
});
```

### 회귀 테스트

**backend/src/focustime/focustime.gateway.spec.ts**

```typescript
describe('FocusTimeGateway', () => {
  describe('handleFocusTaskUpdated', () => {
    it('focus_task_updated 이벤트를 방에 브로드캐스트한다', async () => {
      // Given: 인증된 클라이언트가 방에 있음
      // When: focus_task_updated 이벤트 발생
      // Then: 같은 방에 focus_task_updated 브로드캐스트
    });

    it('startFocusing을 호출하지 않는다 (lastFocusStartTime 유지)', async () => {
      // Given: 인증된 클라이언트가 FOCUSING 상태
      // When: focus_task_updated 이벤트 발생
      // Then: FocusTimeService.startFocusing 호출 안됨
    });
  });
});
```

**frontend/test/integration/tasks.api.spec.ts**

```typescript
describe('useTasksStore', () => {
  describe('editTask', () => {
    it('집중 중인 Task 이름 변경 시 focus_task_updated 이벤트를 전송한다', async () => {
      // Given: Task가 isRunning=true이고, status=FOCUSING
      // When: editTask 호출
      // Then: socket.emit('focus_task_updated', { taskName }) 호출됨
    });

    it('집중 중이 아닌 Task 이름 변경 시 focus_task_updated 이벤트를 전송하지 않는다', async () => {
      // Given: Task가 isRunning=false
      // When: editTask 호출
      // Then: socket.emit 호출 안됨
    });
  });
});
```

### 문서 업데이트

**docs/api/SOCKET_EVENTS.md** - `focus_task_updated` 이벤트 추가:

클라이언트 → 서버:
```markdown
### focus_task_updated

집중 중인 태스크 이름 변경 (focusing 상태에서만 호출)

```typescript
socket.emit('focus_task_updated', {
  taskName: string  // 변경된 태스크 이름
});
```

**서버 동작:**
- `lastFocusStartTime`을 변경하지 않음 (세션 유지)
- 같은 방에 `focus_task_updated` 브로드캐스트
```

서버 → 클라이언트:
```markdown
### focus_task_updated

집중 태스크 이름 변경 알림

```typescript
socket.on('focus_task_updated', (data: {
  userId: string,
  username: string,
  taskName: string
}) => {
  // RemotePlayer의 태스크 이름 업데이트
});
```
```

---

## 수정 파일 요약

| 버그 | 파일 | 변경 내용 |
|------|------|----------|
| #120 | `backend/src/focustime/focustime.gateway.ts` | `currentSessionSeconds` 추가 |
| #120 | `backend/src/player/player.gateway.ts` | `players_synced`에 `currentSessionSeconds` 추가 |
| #120 | `frontend/src/game/players/RemotePlayer.ts` | 서버 `currentSessionSeconds` 사용, 1초마다 증가 |
| #120 | `frontend/src/game/managers/SocketManager.ts` | `focused` 핸들러에 `currentSessionSeconds` 전달 |
| #121 | `backend/src/player/player.gateway.ts` | `joined` 이벤트에 focusTime 포함 |
| #121 | `frontend/src/stores/useFocusTimeStore.ts` | `syncFromServer` 액션 추가 |
| #121 | `frontend/src/game/managers/SocketManager.ts` | `joined` 핸들러에서 `syncFromServer` 호출 |
| #122 | `backend/src/focustime/focustime.gateway.ts` | `focus_task_updated` 핸들러 추가 |
| #122 | `frontend/src/stores/useTasksStore.ts` | `editTask`에서 `focus_task_updated` 전송 |
| #122 | `frontend/src/game/managers/SocketManager.ts` | `focus_task_updated` 핸들러 추가 |

## 테스트 파일 요약

| 버그 | 테스트 파일 | 테스트 내용 |
|------|-------------|------------|
| #120 | `backend/src/focustime/focustime.gateway.spec.ts` | `currentSessionSeconds` 포함 검증 |
| #120 | `frontend/test/integration/focus.socket.spec.ts` | `currentSessionSeconds` 초기화, 1초 증가 |
| #121 | `backend/src/player/player.gateway.spec.ts` | `joined` 이벤트 focusTime 포함 검증 |
| #121 | `frontend/test/unit/useFocusTimeStore.spec.ts` | `syncFromServer` 검증 |
| #122 | `backend/src/focustime/focustime.gateway.spec.ts` | `focus_task_updated` 브로드캐스트 |
| #122 | `frontend/test/integration/tasks.api.spec.ts` | `editTask`에서 `focus_task_updated` 전송 |

## 문서 업데이트 요약

| 문서 | 변경 내용 |
|------|----------|
| `docs/api/SOCKET_EVENTS.md` | `focused` 스키마에 `currentSessionSeconds` 추가 |
| `docs/api/SOCKET_EVENTS.md` | `joined` 이벤트 추가 (focusTime 포함) |
| `docs/api/SOCKET_EVENTS.md` | `focus_task_updated` 이벤트 추가 (C→S, S→C) |
| `docs/features/FOCUS_TIME.md` | 시퀀스 다이어그램 추가 (완료) |
