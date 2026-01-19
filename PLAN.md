# 작업 계획

---

# Part 1: 버그 수정 (현재 작업)

## 개요

브랜치 `feat/#112-api-integration`에서 작업한 기능의 버그 및 미완성 기능 보완

---

## 버그 1: 접속 시 작업중/휴식중 표시 (이슈 #114)

### 현상
- 첫 접속 시 다른 사용자의 작업 태그 상태가 보이지 않음

### 원인 분석

**백엔드 (정상):**
- `player.gateway.ts:131-157`에서 `players_synced` 이벤트에 status 포함하여 전송

**프론트엔드 (문제):**
```typescript
// SocketManager.ts:213-216
if (data.status === "FOCUSING") {
  remotePlayer.setFocusState(true);
}
```
- FOCUSING일 때만 `setFocusState` 호출
- **RESTING일 때는 호출하지 않아서 태스크 버블이 생성되지 않음**

### 해결 방안

`SocketManager.ts`의 `addRemotePlayer`에서 상태와 관계없이 항상 `setFocusState` 호출:

```typescript
// 입장 시 기존 플레이어의 집중 상태 반영
remotePlayer.setFocusState(data.status === "FOCUSING");
```

### 검증 방법
- [x] 브라우저 A에서 휴식 중 상태로 접속
- [x] 브라우저 B에서 새로 접속
- [x] B에서 A의 "휴식 중" 태그가 보이는지 확인

### 상태: ✅ 완료

---

## 버그 2: taskname 브로드캐스트

### 현상
- 다른 플레이어가 어떤 태스크에 집중 중인지 태그에 표시되지 않음

### 원인 분석

#### 1차 분석 (코드 흐름)

**프론트엔드:**
- `useFocusTimeStore.ts:46`에서 `socket.emit("focusing")` 호출 시 taskName 미전송

**백엔드:**
- `focustime.gateway.ts:22-47`에서 taskName을 받지 않음
- 브로드캐스트에 taskName 미포함

**RemotePlayer:**
- `RemotePlayer.ts:21-22`에 TODO 주석만 존재

#### 2차 분석 (테스트 실패 후)

**백엔드 로그:**
```
Received focusing event - data: {}
```

**문제:** 프론트엔드에서 taskName이 undefined로 전송됨

**근본 원인:** Task 타입의 필드명 불일치
```typescript
// types.ts - 기존
interface Task {
  text: string;  // 프론트엔드 필드명
}

// 백엔드 API 응답
interface TaskRes {
  description: string;  // 백엔드 필드명
}
```

`TasksMenu.tsx`에서 `targetTask?.description`을 사용했지만, 실제 Task 타입에는 `text` 필드만 있어서 undefined 발생

### 해결 방안

Task 타입을 백엔드 API와 통일:

```typescript
// types.ts - 수정 후
export interface Task {
  id: number;
  description: string;  // text → description 통일
  completed: boolean;
  time: number;
  isRunning?: boolean;
  createdDate: string;
}
```

### 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/app/_components/TasksMenu/types.ts` | `text` → `description` |
| `frontend/src/app/_components/TasksMenu/TaskItem.tsx` | `task.text` → `task.description` |
| `frontend/src/app/_components/TasksMenu/TasksMenu.tsx` | taskName 전달 로직 |
| `frontend/src/stores/useTasksStore.ts` | 필드명 통일 |

### 교훈

> **코드 수정 전에 types.ts 먼저 확인할 것**
>
> 이 버그는 코드 검색 전에 타입 정의를 먼저 확인했으면 바로 발견할 수 있었음.
> CLAUDE.md에 작업 순서 규칙 추가함.

### 상태: ✅ 완료

---

## 버그 3: 집중시간 브로드캐스트

### 현상
- 다른 플레이어의 집중 시간이 실시간으로 업데이트되지 않음

### 요구사항 명확화

**표시할 데이터:**
- `totalFocusMinutes` (분 단위 누적 집중 시간)
- 집중 중: `totalFocusMinutes + (현재시간 - lastFocusStartTime) / 60`
- 휴식 중: `totalFocusMinutes`만 표시

**표시 위치:**
- 캐릭터 유저네임 아래 (`focusTimeText`, y: 66)
- 작업 태그(`taskBubble`)와는 별개

### 설계 논의

#### 실시간 업데이트 방식

**검토한 방안:**
1. 서버에서 1초마다 브로드캐스트 → 네트워크 부하 심함 ❌
2. 프론트엔드에서 로컬 계산 → 채택 ✅

**채택한 방식:**
```
서버: focused 이벤트 (1회)
  → lastFocusStartTime, totalFocusMinutes 전송

프론트엔드 (RemotePlayer):
  → 1초마다 로컬에서 시간 계산
  → (현재시간 - lastFocusStartTime) + totalFocusMinutes * 60
  → UI만 갱신 (네트워크 요청 없음)
```

#### 보안 검토

**결론: 보안 문제 없음**

- 클라이언트에서 계산하는 것은 **표시용**
- 실제 집중 시간 데이터는 **서버(DB)에서 관리**
- 악의적 사용자가 클라이언트 코드를 조작해도 본인 화면에서만 다르게 보임
- 집중 시작/종료 시점은 서버가 기록하므로 조작 불가

### 구현 내용

#### 3-1: 백엔드 - focused/rested 이벤트에 totalFocusMinutes 추가

```typescript
// focustime.gateway.ts
client.to(roomId).emit('focused', {
  userId: client.id,
  username: focusTime.player.nickname,
  status: focusTime.status,
  lastFocusStartTime: focusTime.lastFocusStartTime,
  totalFocusMinutes: focusTime.totalFocusMinutes,  // 추가
  taskName: data?.taskName,
});

client.to(roomId).emit('rested', {
  userId: client.id,
  username: focusTime.player.nickname,
  status: focusTime.status,
  totalFocusMinutes: focusTime.totalFocusMinutes,  // 추가
});
```

#### 3-2: 백엔드 - players_synced에 totalFocusMinutes 추가

```typescript
// player.gateway.ts
const statusMap = new Map<
  number,
  { status: string; lastFocusStartTime: Date | null; totalFocusMinutes: number }
>();
// ...
totalFocusMinutes: status?.totalFocusMinutes ?? 0,
```

#### 3-3: 프론트엔드 - SocketManager 수정

```typescript
// SocketManager.ts
interface PlayerData {
  // ...기존 필드
  totalFocusMinutes?: number;  // 추가
}

// focused 이벤트 핸들러
socket.on("focused", (data) => {
  remotePlayer.setFocusState(true, {
    taskName: data.taskName,
    lastFocusStartTime: data.lastFocusStartTime,
    totalFocusMinutes: data.totalFocusMinutes ?? 0,
  });
});

// rested 이벤트 핸들러
socket.on("rested", (data) => {
  remotePlayer.setFocusState(false, {
    totalFocusMinutes: data.totalFocusMinutes ?? 0,
  });
});

// addRemotePlayer
remotePlayer.setFocusState(data.status === "FOCUSING", {
  lastFocusStartTime: data.lastFocusStartTime ?? undefined,
  totalFocusMinutes: data.totalFocusMinutes ?? 0,
});
```

#### 3-4: 프론트엔드 - RemotePlayer 타이머 로직 추가

```typescript
// RemotePlayer.ts
interface FocusTimeOptions {
  taskName?: string;
  lastFocusStartTime?: string | null;
  totalFocusMinutes?: number;
}

export default class RemotePlayer extends BasePlayer {
  private focusTimeTimer: Phaser.Time.TimerEvent | null = null;
  private totalFocusMinutes: number = 0;
  private lastFocusStartTime: Date | null = null;

  setFocusState(isFocusing: boolean, options?: FocusTimeOptions) {
    this.totalFocusMinutes = options?.totalFocusMinutes ?? 0;

    // 기존 타이머 정리 (상태 변경 시 중복 방지)
    if (this.focusTimeTimer) {
      this.focusTimeTimer.destroy();
      this.focusTimeTimer = null;
    }

    if (isFocusing) {
      this.lastFocusStartTime = options?.lastFocusStartTime
        ? new Date(options.lastFocusStartTime)
        : new Date();

      // 1초마다 집중 시간 UI 업데이트 (로컬 계산)
      this.focusTimeTimer = this.scene.time.addEvent({
        delay: 1000,
        callback: () => this.updateFocusTimeDisplay(),
        loop: true,
      });
    } else {
      // 휴식 시: 누적 시간만 표시
      this.updateFocusTime(this.totalFocusMinutes * 60);
    }

    this.updateTaskBubble({ isFocusing, taskName: options?.taskName });
  }

  private updateFocusTimeDisplay() {
    const currentSessionSeconds = Math.floor(
      (Date.now() - this.lastFocusStartTime.getTime()) / 1000,
    );
    const totalSeconds = this.totalFocusMinutes * 60 + currentSessionSeconds;
    this.updateFocusTime(totalSeconds);
  }

  destroy() {
    if (this.focusTimeTimer) {
      this.focusTimeTimer.destroy();
    }
    super.destroy();
  }
}
```

### 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/focustime/focustime.gateway.ts` | focused/rested에 totalFocusMinutes 추가 |
| `backend/src/player/player.gateway.ts` | players_synced에 totalFocusMinutes 추가 |
| `frontend/src/game/managers/SocketManager.ts` | 집중시간 데이터 전달 |
| `frontend/src/game/players/RemotePlayer.ts` | 타이머 로직 추가 |

### 검증 방법
- [ ] 브라우저 A에서 집중 시작
- [ ] 브라우저 B에서 A의 집중 시간이 1초마다 증가하는지 확인
- [ ] A가 휴식으로 전환 시 B에서 누적 시간만 표시되는지 확인

### 상태: ✅ 완료

---

## 추가 작업: 버그 2 regression 수정

### 현상
버그 3 수정 후 버그 2가 다시 발생
- 로컬 플레이어의 taskName이 화면에 표시되지 않음
- 다른 플레이어에게는 정상 표시됨

### 원인 분석

**디버깅 과정:**
1. 로그 추가하여 데이터 흐름 확인
2. SocketManager에서 taskName은 정상 수신됨
3. 로컬 플레이어의 taskBubble만 업데이트 안 됨

**근본 원인:**
`MapScene.ts:311`에서 `runningTask?.text` 사용 (잘못된 필드명)

```typescript
// 버그 코드
const taskName = runningTask?.text;

// 수정 후
const taskName = runningTask?.description;
```

버그 2에서 Task 타입의 `text` → `description` 변경 시 MapScene.ts 누락됨

### 해결
`MapScene.ts:311`의 `runningTask?.text` → `runningTask?.description` 수정

### 교훈
> **타입 필드명 변경 시 모든 참조 위치 확인 필요**
>
> IDE의 "Find All References" 기능 활용하여 누락 방지

### 상태: ✅ 완료

---

## 추가 작업: 디버그 로그 제거

버그 2 디버깅 중 추가했던 console.log 제거

| 파일 | 제거 내용 |
|------|----------|
| `frontend/src/app/_components/TasksMenu/TasksMenu.tsx` | handleToggleTaskTimer 로그 |
| `frontend/src/stores/useFocusTimeStore.ts` | startFocusing 로그 |
| `frontend/src/game/managers/SocketManager.ts` | focused, players_synced, addRemotePlayer 로그 |

### 상태: ✅ 완료

---

## 추가 작업: CLAUDE.md 규칙 추가

버그 2 디버깅 과정에서 타입 정의 확인 없이 코드 검색부터 시작하여 시간 낭비 발생.
재발 방지를 위해 CLAUDE.md에 작업 순서 규칙 추가:

```markdown
## 작업 순서

1. **문서 먼저 확인** - 코드 수정/검색 전에 관련 문서 확인
   - 게임 관련: `@docs/architecture/GAME_ENGINE.md`
   - API 관련: `@docs/api/SOCKET_EVENTS.md`, `@docs/api/REST_ENDPOINTS.md`
   - 타입 관련: 해당 `types.ts` 파일
2. **코드 검색은 문서에 없을 때만**
```

### 상태: ✅ 완료

---

## 구현 순서 (최종)

| 순서 | 작업 | 파일 | 상태 |
|------|------|------|------|
| 1 | 버그 1: 접속 시 RESTING 상태 태그 표시 | `SocketManager.ts` | ✅ |
| 2 | 버그 2-1: useFocusTimeStore에 taskName 파라미터 추가 | `useFocusTimeStore.ts` | ✅ |
| 3 | 버그 2-2: 백엔드 focustime.gateway에 taskName 처리 | `focustime.gateway.ts` | ✅ |
| 4 | 버그 2-3: SocketManager에서 taskName 전달 | `SocketManager.ts` | ✅ |
| 5 | 버그 2-4: Task 타입 필드명 통일 (text → description) | `types.ts` 등 | ✅ |
| 6 | 버그 3-1: 백엔드에 totalFocusMinutes 추가 | `focustime.gateway.ts`, `player.gateway.ts` | ✅ |
| 7 | 버그 3-2: SocketManager에서 집중시간 데이터 전달 | `SocketManager.ts` | ✅ |
| 8 | 버그 3-3: RemotePlayer에 집중 시간 타이머 추가 | `RemotePlayer.ts` | ✅ |
| 9 | 버그 2 regression 수정: MapScene.ts 필드명 수정 | `MapScene.ts` | ✅ |
| 10 | 디버그 로그 제거 | `TasksMenu.tsx`, `useFocusTimeStore.ts`, `SocketManager.ts` | ✅ |
| 11 | CLAUDE.md 규칙 추가 | `CLAUDE.md` | ✅ |
| 12 | 통합 테스트 | - | ⬜ |

---

# Part 3: 테스트 코드 작성

## 테스트 계획

### 목표
Part 1에서 수정한 버그들에 대한 테스트 코드 작성

### 테스트 대상

| 버그 | 변경 내용 | 테스트 파일 |
|------|----------|------------|
| 버그 1 | RESTING 상태도 setFocusState 호출 | `socket-manager.spec.ts` |
| 버그 2 | taskName 브로드캐스트 | `socket-manager.spec.ts` |
| 버그 3 | totalFocusMinutes, lastFocusStartTime 전달 | `socket-manager.spec.ts` |

### 테스트 케이스

#### 버그 1: RESTING 상태 태그 표시

| 테스트 케이스 | 검증 대상 |
|-------------|----------|
| `players_synced로 RESTING 상태를 수신하면 setFocusState(false)가 호출된다` | RESTING 상태 처리 |

#### 버그 2: taskName 브로드캐스트

| 테스트 케이스 | 검증 대상 |
|-------------|----------|
| `focused 이벤트 수신 시 taskName이 setFocusState에 전달된다` | taskName 전달 |
| `players_synced로 FOCUSING 상태 수신 시 옵션 객체가 전달된다` | 초기 상태 옵션 |

#### 버그 3: 집중시간 브로드캐스트

| 테스트 케이스 | 검증 대상 |
|-------------|----------|
| `focused 이벤트 수신 시 totalFocusMinutes, lastFocusStartTime이 전달된다` | 집중시간 데이터 |
| `rested 이벤트 수신 시 totalFocusMinutes가 전달된다` | 휴식 시 누적시간 |
| `players_synced에서 totalFocusMinutes가 전달된다` | 입장 시 집중시간 |

---

## 구현 진행

### socket-manager.spec.ts 확장

**파일:** `frontend/test/integration/socket-manager.spec.ts`

#### 버그 1 테스트

| 상태 | 테스트 케이스 |
|------|-------------|
| ✅ | RESTING 상태 수신 시 setFocusState(false) 호출 |

#### 버그 2 테스트

| 상태 | 테스트 케이스 |
|------|-------------|
| ✅ | focused 이벤트에서 taskName 전달 |

#### 버그 3 테스트

| 상태 | 테스트 케이스 |
|------|-------------|
| ✅ | focused 이벤트에서 totalFocusMinutes, lastFocusStartTime 전달 |
| ✅ | rested 이벤트에서 totalFocusMinutes 전달 |
| ✅ | players_synced에서 totalFocusMinutes 전달 |

### 테스트 실행 결과

```
 ✓ test/integration/socket-manager.spec.ts (8 tests)
 ✓ test/integration/tasks.api.spec.ts (13 tests)
 ✓ test/integration/focus.socket.spec.ts (2 tests)

 Test Files  3 passed (3)
      Tests  23 passed (23)
```

### 추가 수정 사항

| 파일 | 변경 내용 |
|------|----------|
| `frontend/test/integration/tasks.api.spec.ts` | `text` → `description` 필드명 수정 (버그 2 영향) |
| `docs/conventions/TEST_CONVENTION.md` | Given-When-Then 주석 필수 규칙, `--run` 옵션 안내 추가 |

---

## 전체 수정 파일 목록

### 백엔드
| 파일 | 변경 내용 |
|------|----------|
| `src/focustime/focustime.gateway.ts` | taskName 수신, totalFocusMinutes 브로드캐스트 |
| `src/player/player.gateway.ts` | players_synced에 totalFocusMinutes 추가 |

### 프론트엔드
| 파일 | 변경 내용 |
|------|----------|
| `src/app/_components/TasksMenu/types.ts` | text → description 통일 |
| `src/app/_components/TasksMenu/TaskItem.tsx` | task.text → task.description |
| `src/app/_components/TasksMenu/TasksMenu.tsx` | taskName 전달, 디버그 로그 제거 |
| `src/stores/useTasksStore.ts` | 필드명 통일 |
| `src/stores/useFocusTimeStore.ts` | 디버그 로그 제거 |
| `src/game/managers/SocketManager.ts` | 집중시간 데이터 전달, 디버그 로그 제거 |
| `src/game/players/RemotePlayer.ts` | 타이머 로직 추가 |
| `src/game/scenes/MapScene.ts` | runningTask?.text → description 수정 |

### 설정
| 파일 | 변경 내용 |
|------|----------|
| `CLAUDE.md` | 작업 순서 규칙 추가 |

---

# Part 2: 백엔드 API - 프론트엔드 연동 계획 (완료)

## 현황 분석

### 백엔드 (이미 구현됨)

**Task REST API:**
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/tasks` | Task 생성 |
| GET | `/api/tasks?date=YYYY-MM-DD` | Task 목록 조회 |
| PATCH | `/api/tasks/completion/:taskId` | Task 완료 처리 |
| PATCH | `/api/tasks/uncompletion/:taskId` | Task 완료 취소 |
| PATCH | `/api/tasks/:taskId` | Task 수정 |
| DELETE | `/api/tasks/:taskId` | Task 삭제 |

**FocusTime WebSocket:**
| 방향 | 이벤트 | 설명 |
|------|--------|------|
| C→S | `focusing` | 집중 시작 (taskName 포함) |
| C→S | `resting` | 휴식 시작 |
| S→C | `focused` | 다른 유저 집중 시작 알림 (lastFocusStartTime, totalFocusMinutes, taskName 포함) |
| S→C | `rested` | 다른 유저 휴식 시작 알림 (totalFocusMinutes 포함) |
| S→C | `players_synced` | 입장 시 기존 플레이어 상태 (status, lastFocusStartTime, totalFocusMinutes 포함) |

### 프론트엔드 (연동 완료)

| 파일 | 현재 상태 |
|------|----------|
| `types.ts` | id: number, description 사용 |
| `useTasksStore.ts` | API 호출 연동 완료 |
| `useFocusTimeStore.ts` | 소켓 이벤트 연동 완료 |
| `SocketManager.ts` | focused/rested/players_synced 처리 완료 |
| `RemotePlayer.ts` | setFocusState, 집중시간 타이머 완료 |
| `TasksMenu.tsx` | startFocusing/stopFocusing 호출 완료 |

---

## 주의사항

1. **타입 일관성**: 백엔드 id는 `number`, Task.description 필드명 통일됨
2. **시간 단위**: 백엔드 `totalFocusMinutes` (분) ↔ 프론트엔드 초 단위 변환
3. **낙관적 업데이트**: 네트워크 지연 대비 UI 먼저 업데이트, 실패 시 롤백
4. **소켓 연결 상태**: 소켓 미연결 시 이벤트 발송 방지
5. **집중시간 계산**: 프론트엔드에서 로컬 계산 (서버 브로드캐스트 최소화)
