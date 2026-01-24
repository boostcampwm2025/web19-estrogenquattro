# #197: 태스크 전환 후 시간 합산 버그

## 이슈 정보

- **이슈:** [#197](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/197)
- **브랜치:** `fix/#197-task-time-accumulation`
- **우선순위:** CRITICAL
- **영역:** Frontend (useFocusTimeStore)

---

## 버그 설명

개별 태스크에서 집중 시간을 진행하다가 다른 태스크로 전환하여 시간을 진행한 후 새로고침하면, 첫 번째 태스크에 두 번째 태스크의 시간까지 합산되어 표시됨

### 재현 방법

1. 태스크 A에서 집중 시간을 시작한다 (예: 5분 진행)
2. 태스크 A를 중지하고 태스크 B에서 집중 시간을 시작한다 (예: 3분 진행)
3. 페이지를 새로고침한다
4. 태스크 A에 8분(5분+3분)이 표시됨 ❌

### 예상 동작

새로고침 후에도 각 태스크에 해당 태스크에서 진행한 시간만 표시되어야 함

- 태스크 A: 5분
- 태스크 B: 3분

---

## 버그 재현 환경 구성

### 로컬 재현 단계

```bash
# 1. 백엔드 실행
cd backend && pnpm start:dev

# 2. 프론트엔드 실행
cd frontend && pnpm dev

# 3. 브라우저에서 http://localhost:3000 접속
# 4. GitHub 로그인 후 게임 입장
```

### 재현 시나리오

| 단계 | 액션 | 프론트엔드 | 백엔드 DB |
|------|------|-----------|----------|
| 1 | 태스크 A 생성 | A 표시 | A.totalFocusSeconds=0 |
| 2 | 태스크 A 집중 시작 | focusing 이벤트 전송 | currentTaskId=A |
| 3 | 5분 경과 | A 타이머: 300초 | - |
| 4 | 태스크 B 클릭 (전환) | **focusing 이벤트 무시됨!** | currentTaskId=A 유지 ❌ |
| 5 | 3분 경과 | B 타이머: 180초 | A에 시간 누적 중 |
| 6 | 새로고침 | fetchTasks() | A.totalFocusSeconds=480 ❌ |

### DB 상태 확인 쿼리

```sql
-- SQLite CLI 또는 DB 브라우저로 확인
sqlite3 backend/data/jandi.sqlite

-- 태스크별 시간 확인
SELECT id, description, total_focus_seconds, created_date
FROM tasks
WHERE player_id = (SELECT id FROM players WHERE nickname = 'YOUR_USERNAME');

-- 일별 집중 시간 확인
SELECT id, total_focus_seconds, current_task_id, status, last_focus_start_time
FROM daily_focus_time
WHERE player_id = (SELECT id FROM players WHERE nickname = 'YOUR_USERNAME');
```

---

## 원인 분석 (확정)

### 근본 원인

**프론트엔드 `useFocusTimeStore.ts`에서 Task 전환 시 서버에 새로운 taskId를 전송하지 않음**

### 문제 코드

#### 1. useFocusTimeStore.ts (56-60줄)

```typescript
startFocusing: (taskName?: string, taskId?: number) => {
  const prev = get();

  // ⚠️ 이미 FOCUSING이면 무조건 무시 ← 여기가 문제!
  if (prev.status === "FOCUSING") return;

  // ... 소켓 이벤트 전송 로직 (실행되지 않음)
};
```

#### 2. TasksMenu.tsx (152-170줄)

```typescript
const handleToggleTaskTimer = (id: number) => {
  const targetTask = tasks.find((task) => task.id === id);

  if (targetTask && targetTask.isRunning) {
    stopFocusing();  // 같은 Task 클릭 → 정지
  } else {
    // Task 전환 시 focusing 이벤트 전송 시도
    startFocusing(targetTask?.description, targetTask?.id);  // ← 무시됨!
  }

  toggleTaskTimer(id);  // ← UI만 업데이트됨 (서버와 불일치)
};
```

### 버그 발생 흐름

```
┌────────────────────────────────────────────────────────────────────┐
│                        버그 발생 시퀀스                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [1] Task A 시작                                                   │
│      ├─ startFocusing('Task A', 1) 호출                            │
│      ├─ status === 'RESTING' → 통과                                │
│      ├─ socket.emit('focusing', { taskId: 1 }) ✅                  │
│      └─ 백엔드: currentTaskId = 1                                  │
│                                                                    │
│  [2] Task B 클릭 (전환)                                            │
│      ├─ startFocusing('Task B', 2) 호출                            │
│      ├─ status === 'FOCUSING' → return ❌ (무시됨!)                │
│      ├─ socket.emit() 실행 안됨                                    │
│      ├─ toggleTaskTimer(2) → UI에서 B가 isRunning=true             │
│      └─ 백엔드: currentTaskId = 1 (변경 없음!)                      │
│                                                                    │
│  [3] 3분 경과                                                      │
│      ├─ 프론트엔드: Task B 타이머 180초 표시                        │
│      └─ 백엔드: Task A(id=1)에 시간 누적 중                         │
│                                                                    │
│  [4] 새로고침                                                      │
│      ├─ disconnect → startResting() → A에 480초 저장               │
│      ├─ fetchTasks() 호출                                          │
│      └─ A: 480초, B: 0초 표시 ❌                                    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 백엔드 코드는 정상

백엔드 `focustime.service.ts`의 `startFocusing()` 메서드는 이미 올바르게 구현되어 있음:

```typescript
// backend/src/focustime/focustime.service.ts (92-112줄)
// 이미 집중 중이었다면 이전 집중 시간을 먼저 누적 (태스크 전환 시 시간 누락 방지)
if (focusTime.status === FocusStatus.FOCUSING && focusTime.lastFocusStartTime) {
  const diffMs = now.getTime() - focusTime.lastFocusStartTime.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  focusTime.totalFocusSeconds += diffSeconds;

  // ✅ 이전 Task에만 시간 추가 (정상 동작)
  if (focusTime.currentTaskId && diffSeconds > 0) {
    await this.addFocusTimeToTask(
      manager,
      playerId,
      focusTime.currentTaskId,  // ← 이전 Task
      diffSeconds,
    );
  }
}

// 새 태스크로 업데이트
focusTime.currentTaskId = verifiedTaskId;  // ← 새 Task로 변경
```

**문제는 프론트엔드에서 이 메서드를 호출하지 않는 것!**

---

## 해결 방안

### 방안 1: Task 전환 시 소켓 이벤트 전송 허용 (권장 ⭐)

```typescript
// frontend/src/stores/useFocusTimeStore.ts
startFocusing: (taskName?: string, taskId?: number) => {
  const prev = get();

  // 1. Guard 먼저: taskId 없이 이미 FOCUSING이면 무시 (no-op)
  // 소켓 체크보다 먼저 실행하여 불필요한 에러 표시 방지
  const isTaskSwitch = taskId !== undefined;
  if (prev.status === "FOCUSING" && !isTaskSwitch) {
    return;
  }

  // 2. 소켓 체크: 실제 전송이 필요한 경우에만 검사
  const socket = getSocket();
  if (!socket?.connected) {
    set({ error: "서버와 연결되지 않았습니다." });
    return;
  }

  // 낙관적 업데이트
  set({
    status: FOCUS_STATUS.FOCUSING,
    isFocusTimerRunning: true,
    focusStartTimestamp: Date.now(),
    baseFocusSeconds: prev.focusTime,
    error: null,
  });

  // 소켓 이벤트 전송 (Task 전환 시에도 전송됨)
  socket.emit(
    "focusing",
    { taskName, taskId },
    (response: { success: boolean; error?: string }) => {
      if (!response?.success) {
        set({
          status: "RESTING",
          isFocusTimerRunning: false,
          focusStartTimestamp: null,
          error: response?.error || "집중 시작에 실패했습니다.",
        });
      }
    },
  );
};
```

**장점:**

- 최소한의 코드 변경
- 기존 로직 구조 유지
- Task 전환과 일반 집중 시작 모두 처리

### 방안 2: Task 전환 전용 함수 추가

```typescript
// frontend/src/stores/useFocusTimeStore.ts
switchTask: (taskName: string, taskId: number) => {
  const socket = getSocket();
  if (!socket?.connected) {
    set({ error: "서버와 연결되지 않았습니다." });
    return;
  }

  // Task 전환 시에도 focusing 이벤트 전송
  socket.emit(
    "focusing",
    { taskName, taskId },
    (response: { success: boolean; error?: string }) => {
      if (!response?.success) {
        set({ error: response?.error || "Task 전환에 실패했습니다." });
      }
    },
  );
};
```

```typescript
// TasksMenu.tsx 수정
const handleToggleTaskTimer = (id: number) => {
  const targetTask = tasks.find((task) => task.id === id);

  if (targetTask && targetTask.isRunning) {
    stopFocusing();
  } else if (isFocusTimerRunning) {
    // 이미 집중 중이면 Task 전환
    switchTask(targetTask?.description, targetTask?.id);
  } else {
    // 새로 시작
    startFocusing(targetTask?.description, targetTask?.id);
  }

  toggleTaskTimer(id);
};
```

**장점:**

- 명확한 의도 표현 (시작 vs 전환 구분)
- 각 함수의 책임 분리

### 방안 3: TasksMenu에서 직접 소켓 이벤트 전송

```typescript
// TasksMenu.tsx - handleToggleTaskTimer
} else {
  // Task 전환 시 기존 guard 무시하고 직접 소켓 전송
  const socket = getSocket();
  socket?.emit("focusing", {
    taskName: targetTask?.description,
    taskId: targetTask?.id
  });
}
```

**장점:**

- 가장 빠른 수정
- FocusTimeStore 수정 불필요

**단점:**

- 로직 중복
- 에러 처리 누락 가능

---

## 권장 해결책

**방안 1을 권장합니다.**

### 수정 코드

```typescript
// frontend/src/stores/useFocusTimeStore.ts

startFocusing: (taskName?: string, taskId?: number) => {
  const prev = get();

  // 1. Guard 먼저: taskId가 없고 이미 FOCUSING이면 무시 (no-op)
  // 소켓 체크보다 먼저 실행하여 불필요한 에러 표시 방지
  const isTaskSwitch = taskId !== undefined;
  if (prev.status === "FOCUSING" && !isTaskSwitch) {
    return;
  }

  // 2. 소켓 체크: 실제 전송이 필요한 경우에만 검사
  const socket = getSocket();
  if (!socket?.connected) {
    set({
      error: "서버와 연결되지 않았습니다. 잠시 후 다시 시도해주세요.",
    });
    return;
  }

  // 낙관적 업데이트
  set({
    status: FOCUS_STATUS.FOCUSING,
    isFocusTimerRunning: true,
    focusStartTimestamp: Date.now(),
    baseFocusSeconds: prev.focusTime,
    error: null,
  });

  // 소켓 이벤트 전송 (응답 callback 포함)
  socket.emit(
    "focusing",
    { taskName, taskId },
    (response: { success: boolean; error?: string }) => {
      if (!response?.success) {
        // 에러 시 롤백
        set({
          status: "RESTING",
          isFocusTimerRunning: false,
          focusStartTimestamp: null,
          error: response?.error || "집중 시작에 실패했습니다.",
        });
      }
    },
  );
},
```

---

## 작업 순서

### Phase 1: 원인 파악 ✅ 완료

- [x] 로컬에서 버그 재현
- [x] 백엔드 코드 분석 (정상 동작 확인)
- [x] 프론트엔드 코드 분석 (원인 발견)
- [x] 원인 확정: `useFocusTimeStore.startFocusing()`의 early return

### Phase 2: 수정 ✅ 완료

- [x] `useFocusTimeStore.ts` 수정 (방안 1 적용)
- [x] 단위 테스트 추가

### Phase 3: 검증 ✅ 완료

- [x] 재현 시나리오로 버그 수정 확인
- [x] 기존 기능 회귀 테스트
- [x] `/ci` 실행
- [x] PR 생성: #202

---

## 수정 예상 파일

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/stores/useFocusTimeStore.ts` | `startFocusing()` 수정 - Task 전환 시 소켓 이벤트 전송 허용 |

---

## 수정 검증 방법

### 자동화 테스트

```typescript
// frontend/test/integration/focustime-store.spec.ts
describe('useFocusTimeStore', () => {
  describe('startFocusing - Task 전환', () => {
    it('Task A에서 B로 전환 시 서버에 focusing 이벤트가 전송된다', () => {
      // Given: Task A로 집중 중
      useFocusTimeStore.getState().startFocusing('Task A', 1);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'focusing',
        { taskName: 'Task A', taskId: 1 },
        expect.any(Function)
      );

      mockSocket.emit.mockClear();

      // When: Task B로 전환
      useFocusTimeStore.getState().startFocusing('Task B', 2);

      // Then: focusing 이벤트가 다시 전송됨
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'focusing',
        { taskName: 'Task B', taskId: 2 },
        expect.any(Function)
      );
    });

    it('taskId 없이 이미 FOCUSING 상태면 이벤트가 전송되지 않는다', () => {
      // Given: 이미 집중 중 (taskId 없이)
      useFocusTimeStore.getState().startFocusing();
      mockSocket.emit.mockClear();

      // When: taskId 없이 다시 startFocusing 호출
      useFocusTimeStore.getState().startFocusing();

      // Then: 이벤트 전송 안됨 (중복 방지)
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });
});
```

### 수동 검증 체크리스트

| # | 시나리오 | 검증 방법 | 예상 결과 |
|---|---------|----------|----------|
| 1 | A(5분)→B(3분)→새로고침 | Task 목록 확인 | A=300초, B=180초 |
| 2 | A(5분)→휴식→B(3분)→새로고침 | Task 목록 확인 | A=300초, B=180초 |
| 3 | A(5분)→B(3분)→A(2분)→새로고침 | Task 목록 확인 | A=420초, B=180초 |
| 4 | 백엔드 로그 확인 | 콘솔 로그 | `Task switch: saved Xs for previous task` |
| 5 | 일별 totalFocusSeconds | DB 직접 확인 | Task 합계와 일치 |

### 검증 스크립트

```bash
#!/bin/bash
# 수정 후 검증 스크립트

# 1. DB 초기화 (선택 - 주의: 로컬 데이터 삭제됨)
DB_PATH="backend/data/jandi.sqlite"
if [ -f "$DB_PATH" ]; then
  echo "⚠️  WARNING: This will delete the local database!"
  echo "   Path: $DB_PATH"
  read -p "Continue? (y/N) " confirm
  if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    cp "$DB_PATH" "${DB_PATH}.backup"  # 백업 생성
    echo "Backup created: ${DB_PATH}.backup"
    rm "$DB_PATH"
    echo "Database deleted."
  else
    echo "Skipped database deletion."
  fi
fi

# 2. 서버 실행
cd backend && pnpm start:dev &
sleep 5

# 3. 프론트엔드 테스트 실행
cd frontend && pnpm test --run

# 4. E2E 검증 (수동)
echo "브라우저에서 http://localhost:3000 접속 후 시나리오 실행"
```

---

## 주의사항

### 1. 낙관적 업데이트 일관성

```typescript
// Task 전환 시에도 낙관적 업데이트 적용
set({
  status: FOCUS_STATUS.FOCUSING,
  isFocusTimerRunning: true,
  focusStartTimestamp: Date.now(),
  baseFocusSeconds: prev.focusTime,  // 현재까지 누적 시간 유지
  error: null,
});
```

### 2. 에러 시 롤백

```typescript
// 서버 응답 실패 시 이전 상태로 롤백
if (!response?.success) {
  set({
    status: "RESTING",
    isFocusTimerRunning: false,
    focusStartTimestamp: null,
    error: response?.error || "집중 시작에 실패했습니다.",
  });
}
```

### 3. Guard 순서 (소켓 체크보다 먼저)

```typescript
// ✅ Guard를 소켓 체크보다 먼저 실행
// taskId 없이 이미 FOCUSING이면 no-op (에러 표시 없이 조용히 종료)
const isTaskSwitch = taskId !== undefined;
if (prev.status === "FOCUSING" && !isTaskSwitch) {
  return;  // 소켓 연결 상태와 무관하게 바로 종료
}

// 이후에 소켓 체크 (실제 전송 필요한 경우만)
const socket = getSocket();
if (!socket?.connected) {
  set({ error: "서버와 연결되지 않았습니다." });
  return;
}
```

---

## 관련 문서

- [DATABASE.md](../guides/DATABASE.md) - Task, DailyFocusTime 테이블 구조
- [ERD.md](../guides/ERD.md) - 테이블 관계
- [FOCUS_TIME.md](../features/FOCUS_TIME.md) - 포커스 타임 기능 설명
- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md) - focusing/resting 이벤트 명세
