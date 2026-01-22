# #192: 탭 비활성화 시 집중 시간 업데이트 버그

## 이슈 정보

- **이슈:** [#192](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/192)
- **PR:** [#205](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/205)
- **브랜치:** `fix/192-background-timer`
- **우선순위:** CRITICAL
- **영역:** Frontend, Backend
- **상태:** ✅ 완료

---

## 버그 설명

브라우저 탭을 비활성화하거나 창을 최소화하면 개인 태스크의 집중 시간이 업데이트되지 않음

### 재현 방법

1. 집중 모드를 시작한다
2. 다른 탭으로 이동하거나 브라우저를 최소화한다
3. 일정 시간 후 다시 탭으로 돌아온다
4. 집중 시간이 실제 경과 시간보다 적게 표시됨

### 예상 동작

탭 비활성화/최소화 상태에서도 집중 시간이 정확하게 누적되어야 함

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

| 단계 | 액션 | 예상 결과 (버그) | 예상 결과 (수정 후) |
|------|------|-----------------|-------------------|
| 1 | 집중 시작, 10초 대기 | 10초 표시 | 10초 표시 |
| 2 | 다른 탭으로 전환, 60초 대기 | - | - |
| 3 | 원래 탭으로 복귀 | **10~20초 표시** ❌ | **70초 표시** ✅ |

### 디버깅용 콘솔 로그

```javascript
// 브라우저 콘솔에서 실행
setInterval(() => {
  const state = window.__ZUSTAND_DEVTOOLS__?.['focus-time']?.getState();
  console.log('FocusTime:', state?.focusTime, 'Status:', state?.status);
}, 1000);
```

---

## 원인 분석

### 1. 브라우저 쓰로틀링 (핵심 원인)

브라우저는 백그라운드 탭의 타이머를 공격적으로 쓰로틀링:

| 브라우저 | 쓰로틀링 정책 |
|---------|-------------|
| Chrome | 백그라운드 탭: 최소 1초 간격, 5분 후 1분 간격 |
| Firefox | 백그라운드 탭: 최소 1초 간격, 30초 후 더 제한 |
| Safari | 더 공격적인 쓰로틀링 |

> **중요:** `setInterval`도 `setTimeout`도 모두 쓰로틀링 대상입니다!

### 2. 현재 구현의 문제점

**전체 시간, 개별 태스크, 원격 플레이어 모두 동일한 문제 발생:**

#### 2-1. 전체 집중 시간 (Focus Time) - 문제 있음 ❌

```typescript
// TasksMenu.tsx:99-110 - setInterval + count++ 방식
useEffect(() => {
  let interval: number | undefined;
  if (isTimerRunning) {
    interval = window.setInterval(() => {
      incrementFocusTime();  // ← focusTime++ 방식!
    }, 1000);
  }
  return () => { if (interval) clearInterval(interval); };
}, [isTimerRunning, incrementFocusTime]);

// useFocusTimeStore.ts:50-51
incrementFocusTime: () =>
  set((state) => ({ focusTime: state.focusTime + 1 })),  // ← count++ 방식
```

#### 2-2. 개별 태스크 타이머 - 문제 있음 ❌

```typescript
// TasksMenu.tsx:122-135 - setInterval + count++ 방식
useEffect(() => {
  let interval: number | undefined;
  if (runningTask) {
    interval = window.setInterval(() => {
      incrementTaskTime(runningTask.id);  // ← time++ 방식!
    }, 1000);
  }
  return () => { if (interval) clearInterval(interval); };
}, [runningTask, incrementTaskTime]);

// useTasksStore.ts:237-242
incrementTaskTime: (id: number) =>
  set((state) => ({
    tasks: state.tasks.map((task) =>
      task.id === id ? { ...task, time: task.time + 1 } : task,  // ← count++ 방식
    ),
  })),
```

#### 2-3. 원격 플레이어 시간 표시 - 부분적 문제 ⚠️

```typescript
// RemotePlayer.ts:41-59 - Phaser Timer 사용
if (isFocusing) {
  // ✅ 좋음: 타임스탬프 역산
  this.focusStartTimestamp = Date.now() - currentSessionSeconds * 1000;

  // ⚠️ 문제: Phaser Timer callback이 호출되어야 UI 업데이트
  this.focusTimeTimer = this.scene.time.addEvent({
    delay: 1000,
    callback: () => {
      // 계산 자체는 타임스탬프 기반 (정확)
      const elapsed = Math.floor((Date.now() - this.focusStartTimestamp) / 1000);
      this.updateFocusTime(this.totalFocusSeconds + elapsed);
    },
    loop: true,
  });
}
```

- 계산 로직은 타임스탬프 기반 → 계산 자체는 정확
- 하지만 callback이 호출되어야 UI가 업데이트됨
- 탭 복귀 시 즉시 재계산되지 않음

### 3. 쓰로틀링 영향도 요약

| 영역 | 타이머 방식 | 쓰로틀링 영향 | 탭 복귀 시 |
|------|------------|-------------|-----------|
| **전체 시간** | `setInterval` + `count++` | **100%** ❌ | 시간 누락 |
| **개별 태스크** | `setInterval` + `count++` | **100%** ❌ | 시간 누락 |
| **원격 플레이어** | Phaser Timer + 타임스탬프 | **부분** ⚠️ | 즉시 반영 안됨 |

### 4. 문제의 핵심

```
┌─────────────────────────────────────────────────────────────┐
│  현재: callback 호출 횟수 = 표시 시간                        │
│                                                              │
│  탭 활성화:   callback 60회/분 → 60초 표시 ✅                │
│  탭 비활성화: callback 1회/분  → 1초 표시 ❌                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  해결: 표시 시간 = Date.now() - startTimestamp              │
│                                                              │
│  탭 활성화:   60초 경과 → 60초 표시 ✅                       │
│  탭 비활성화: 60초 경과 → 60초 표시 ✅ (탭 복귀 시 재계산)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 해결 방안

### 핵심 전략: 서버 기준 타임스탬프 + 탭 복귀 시 재계산

```
기존: count++ 방식 (쓰로틀링 영향 100%)
변경: 서버 currentSessionSeconds + (현재시간 - 수신시간) 방식
```

### 설계 원칙

1. **서버가 시간의 단일 진실 원천(Single Source of Truth)**
2. **클라이언트는 표시만 담당** (서버 값 기반 렌더링)
3. **탭 복귀 시 즉시 재계산** (visibilitychange 이벤트)

---

## 작업 내용

### 1. useFocusTimeStore 수정

**파일:** `frontend/src/stores/useFocusTimeStore.ts`

```typescript
interface FocusTimeState {
  status: 'FOCUSING' | 'RESTING';

  // 서버에서 받은 기준값
  serverCurrentSessionSeconds: number;  // 서버가 계산한 현재 세션 경과 시간
  serverReceivedAt: number;             // 서버 응답 수신 시점 (클라이언트 시간)
  baseFocusSeconds: number;             // 이전 세션까지의 누적 시간

  // 계산된 표시값 (getter)
  // focusTime = baseFocusSeconds + serverCurrentSessionSeconds + (Date.now() - serverReceivedAt) / 1000
}

// 서버 동기화 (joined, focused 이벤트 수신 시)
syncFromServer: (data: {
  status: 'FOCUSING' | 'RESTING';
  totalFocusSeconds: number;
  currentSessionSeconds: number;
}) => {
  // ⚠️ 중요: totalFocusSeconds는 이전 세션까지의 누적 (현재 세션 미포함)
  // 서버에서 휴식 전환 시에만 totalFocusSeconds가 업데이트됨
  set({
    status: data.status,
    baseFocusSeconds: data.totalFocusSeconds,  // 이전 세션 누적 그대로 사용
    serverCurrentSessionSeconds: data.currentSessionSeconds,  // 현재 세션 경과
    serverReceivedAt: Date.now(),
  });
},

// 표시용 시간 계산 (쓰로틀링 무관)
getFocusTime: () => {
  const { status, baseFocusSeconds, serverCurrentSessionSeconds, serverReceivedAt } = get();

  if (status === 'FOCUSING' && serverReceivedAt) {
    const clientElapsed = Math.floor((Date.now() - serverReceivedAt) / 1000);
    return baseFocusSeconds + serverCurrentSessionSeconds + clientElapsed;
  }

  return baseFocusSeconds;
},
```

### 2. RemotePlayer 수정

**파일:** `frontend/src/game/players/RemotePlayer.ts`

```typescript
class RemotePlayer extends BasePlayer {
  // 서버 기준 시간
  private serverCurrentSessionSeconds: number = 0;
  private serverReceivedAt: number = 0;
  private baseFocusSeconds: number = 0;
  private isFocusing: boolean = false;

  setFocusState(isFocusing: boolean, options?: FocusTimeOptions) {
    this.isFocusing = isFocusing;

    // ⚠️ 중요: totalFocusSeconds는 이전 세션까지의 누적 (현재 세션 미포함)
    if (isFocusing) {
      this.baseFocusSeconds = options?.totalFocusSeconds ?? 0;  // 이전 세션 누적 그대로
      this.serverCurrentSessionSeconds = options?.currentSessionSeconds ?? 0;  // 현재 세션 경과
      this.serverReceivedAt = Date.now();
    } else {
      this.baseFocusSeconds = options?.totalFocusSeconds ?? 0;
      this.serverCurrentSessionSeconds = 0;
      this.serverReceivedAt = 0;
    }

    this.updateFocusDisplay();
    this.updateTaskBubble({ isFocusing, taskName: options?.taskName });
  }

  // 현재 표시할 시간 계산 (MapScene.update()에서 호출)
  getDisplayTime(): number {
    if (this.isFocusing && this.serverReceivedAt) {
      const clientElapsed = Math.floor((Date.now() - this.serverReceivedAt) / 1000);
      return this.baseFocusSeconds + this.serverCurrentSessionSeconds + clientElapsed;
    }
    return this.baseFocusSeconds;
  }

  // UI 업데이트 (getDisplayTime 결과를 화면에 반영)
  updateFocusDisplay() {
    this.updateFocusTime(this.getDisplayTime());
  }
}
```

### 3. visibilitychange 핸들러 추가

**파일:** `frontend/src/game/managers/SocketManager.ts`

```typescript
class SocketManager {
  private visibilityHandler: (() => void) | null = null;

  connect() {
    // ... 기존 로직 ...

    this.setupVisibilityHandler();
  }

  private setupVisibilityHandler() {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.onTabVisible();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private onTabVisible() {
    // 로컬 플레이어 시간 재계산 (타임스탬프 기반이므로 자동 반영)
    const focusTime = useFocusTimeStore.getState().getFocusTime();
    this.player?.updateFocusTime(focusTime);

    // 원격 플레이어들도 재계산
    this.otherPlayers.forEach(remote => {
      remote.updateFocusDisplay();
    });
  }

  // cleanup 필수!
  disconnect() {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    // ... 기존 정리 로직 ...
  }
}
```

### 4. TasksMenu.tsx 수정 (전체 시간 + 개별 태스크)

**파일:** `frontend/src/app/_components/TasksMenu/TasksMenu.tsx`

```typescript
// 기존: setInterval + incrementFocusTime() 제거
// 변경: store selector 사용 + getFocusTime() 단일 소스

// ✅ store selector로 구독 (getState()는 스냅샷만 가져오므로 사용 X)
const { status, getFocusTime, isTimerRunning, baseFocusSeconds } = useFocusTimeStore((state) => ({
  status: state.status,
  getFocusTime: state.getFocusTime,
  isTimerRunning: state.status === 'FOCUSING',  // focus 중일 때 true
  baseFocusSeconds: state.baseFocusSeconds,  // ✅ RESTING 상태에서 갱신 감지용
}));

// tasks store에서 태스크 목록 구독
const { tasks } = useTasksStore((state) => ({ tasks: state.tasks }));

// ✅ 전체 시간: baseFocusSeconds도 의존성에 포함
// ⚠️ 중요: RESTING 상태에서 syncFromServer로 baseFocusSeconds만 갱신될 때도 재계산 필요
const focusTimeDisplay = useMemo(() => {
  return getFocusTime();
}, [tick, status, baseFocusSeconds, getFocusTime]);  // baseFocusSeconds 추가

// 개별 태스크: 동일하게 타임스탬프 기반
const getTaskDisplayTime = (task: Task) => {
  if (task.isRunning && task.startTimestamp) {
    return task.baseTime + Math.floor((Date.now() - task.startTimestamp) / 1000);
  }
  return task.time;
};

// ✅ UI 갱신: focus 또는 태스크 실행 중일 때 tick 업데이트
const hasRunningTask = tasks.some(t => t.isRunning);
const shouldTick = isTimerRunning || hasRunningTask;

const [tick, setTick] = useState(0);
useEffect(() => {
  if (!shouldTick) return;  // focus 또는 태스크 실행 중일 때만
  const interval = window.setInterval(() => setTick(t => t + 1), 1000);
  return () => clearInterval(interval);
}, [shouldTick]);

// visibilitychange 핸들러 추가
useEffect(() => {
  const handler = () => {
    if (document.visibilityState === 'visible') {
      setTick(t => t + 1);  // 탭 복귀 시 즉시 재계산
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}, []);
```

> **⚠️ 중요:**
> - `getState()`는 구독이 아닌 스냅샷이므로 store selector 사용 필수
> - `status` 변경 시에도 재계산되도록 의존성에 포함
> - tick은 focus 뿐 아니라 태스크 실행 중에도 업데이트되어야 함

### 5. useTasksStore.ts 수정

**파일:** `frontend/src/stores/useTasksStore.ts`

```typescript
interface Task {
  id: number;
  description: string;
  time: number;              // 누적 시간 (휴식 시점까지)
  baseTime: number;          // 현재 세션 시작 시점의 시간
  startTimestamp: number | null;  // 타이머 시작 타임스탬프
  isRunning: boolean;
  completed: boolean;
}

// 타이머 시작/정지
toggleTaskTimer: (id: number) => {
  const task = get().tasks.find(t => t.id === id);
  if (!task) return;

  if (task.isRunning) {
    // 정지: 경과 시간 계산하여 time, baseTime에 반영
    const elapsed = task.startTimestamp
      ? Math.floor((Date.now() - task.startTimestamp) / 1000)
      : 0;
    const newTime = task.baseTime + elapsed;
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              isRunning: false,
              time: newTime,
              baseTime: newTime,  // ✅ baseTime도 업데이트 (불변식 유지)
              startTimestamp: null,
            }
          : t
      ),
    }));
  } else {
    // 시작: 현재 시간을 baseTime으로, 타임스탬프 저장
    // ⚠️ 중요: 기존 실행 중인 태스크가 있으면 시간 누적 처리 후 정지
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id === id) {
          // 새로 시작하는 태스크
          return { ...t, isRunning: true, baseTime: t.time, startTimestamp: Date.now() };
        }
        if (t.isRunning && t.startTimestamp) {
          // ✅ 기존 실행 중 태스크: 경과 시간 누적 후 정지
          const elapsed = Math.floor((Date.now() - t.startTimestamp) / 1000);
          const newTime = t.baseTime + elapsed;
          return {
            ...t,
            isRunning: false,
            time: newTime,
            baseTime: newTime,  // ✅ baseTime도 업데이트
            startTimestamp: null,
          };
        }
        return t;  // 이미 정지 상태면 그대로
      }),
    }));
  }
},

// incrementTaskTime 제거 (더 이상 필요 없음)
```

> **⚠️ 중요:** 태스크 전환 시 기존 실행 중인 태스크의 경과 시간을 반드시 누적해야 합니다.
> 단순히 `isRunning: false`만 설정하면 시간이 손실됩니다.

#### 서버에서 태스크 로드 시 초기값 설정

```typescript
// fetchTasks 또는 API 응답 처리 시
const normalizeTask = (serverTask: ServerTask): Task => ({
  id: serverTask.id,
  description: serverTask.description,
  time: serverTask.totalFocusSeconds,
  baseTime: serverTask.totalFocusSeconds,  // ✅ 서버 값으로 초기화
  startTimestamp: null,                     // ✅ 정지 상태로 초기화
  isRunning: false,
  completed: serverTask.isCompleted,
});

fetchTasks: async () => {
  const response = await api.getTasks();
  set({
    tasks: response.tasks.map(normalizeTask),
  });
},
```

### 6. MapScene.update() 수정 (최적화 포함)

**파일:** `frontend/src/game/scenes/MapScene.ts`

```typescript
class MapScene extends Phaser.Scene {
  // 마지막으로 표시한 초 (텍스트 업데이트 최적화)
  private lastDisplayedFocusSecond: number = -1;
  // ✅ 키 타입: visitorId가 string | number일 수 있으므로 string으로 통일
  // ⚠️ 중요: 플레이어 이탈 시 반드시 해당 키 삭제 필요 (메모리 누수 방지)
  private lastDisplayedRemoteSeconds: Map<string, number> = new Map();

  update() {
    // ... 기존 로직 ...

    // ⚠️ 최적화: 초 단위 변화 시에만 텍스트 업데이트
    // 60fps로 매 프레임 텍스트 업데이트하면 불필요한 렌더링 발생
    const focusTime = useFocusTimeStore.getState().getFocusTime();
    if (focusTime !== this.lastDisplayedFocusSecond) {
      this.player.updateFocusTime(focusTime);
      this.lastDisplayedFocusSecond = focusTime;
    }

    // 원격 플레이어도 동일하게 최적화
    // ✅ getOtherPlayers()가 Map<string, RemotePlayer>를 반환해야 함
    // ⚠️ 배열이라면 인덱스가 되어 불안정하므로, 반드시 Map 사용 확인 필요
    this.socketManager?.getOtherPlayers().forEach((remote, visitorId) => {
      const displayTime = remote.getDisplayTime();
      // ✅ 키 타입 통일: String()으로 변환
      const key = String(visitorId);
      const lastTime = this.lastDisplayedRemoteSeconds.get(key) ?? -1;
      if (displayTime !== lastTime) {
        remote.updateFocusDisplay();
        this.lastDisplayedRemoteSeconds.set(key, displayTime);
      }
    });
  }

  // ✅ 플레이어 이탈 시 해당 키 삭제 (메모리 누수 방지)
  // SocketManager에서 player_left 이벤트 수신 시 호출
  removeRemotePlayerCache(visitorId: string | number) {
    this.lastDisplayedRemoteSeconds.delete(String(visitorId));
  }

  // 씬 정리 시 맵 초기화
  shutdown() {
    this.lastDisplayedRemoteSeconds.clear();
    // ... 기존 정리 로직 ...
  }
}
```

> **Note:** `getOtherPlayers()`가 `Map<string, RemotePlayer>`를 반환하는지 확인 필요.
> 배열을 반환한다면 `forEach`의 두 번째 인자가 인덱스가 되어 키 안정성이 깨집니다.
> 안정적인 키(visitorId 등)를 사용하도록 구현해야 합니다.

**최적화 이유:**

| 방식 | 텍스트 업데이트 횟수/초 | 문제점 |
|------|----------------------|--------|
| 매 프레임 | 60회 | 동일한 "00:30" 텍스트를 60번 다시 그림 |
| 초 단위 변화 시 | 1회 | ✅ 필요한 경우에만 업데이트 |

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/stores/useFocusTimeStore.ts` | 서버 기준 타임스탬프 방식으로 변경, `getFocusTime()` 추가 |
| `frontend/src/stores/useTasksStore.ts` | 타임스탬프 기반 태스크 시간 관리, `incrementTaskTime` 제거 |
| `frontend/src/app/_components/TasksMenu/TasksMenu.tsx` | setInterval 제거, 타임스탬프 기반 표시, visibilitychange 핸들러 |
| `frontend/src/game/players/RemotePlayer.ts` | Phaser Timer 제거, `updateFocusDisplay()` 추가 |
| `frontend/src/game/managers/SocketManager.ts` | visibilitychange 핸들러 추가 + cleanup |
| `frontend/src/game/scenes/MapScene.ts` | update()에서 시간 재계산 |

---

## 수정 검증 방법

### 자동화 테스트

```typescript
// frontend/test/integration/focustime.visibility.spec.ts
describe('FocusTime - 탭 비활성화', () => {
  // ⚠️ 중요: Date.now() 기반 계산이므로 반드시 시스템 시간 모킹 필요
  beforeEach(() => {
    vi.useFakeTimers();

    // ✅ 테스트 격리: store 초기 상태 설정 (테스트 순서 의존성 방지)
    useFocusTimeStore.setState({
      status: 'RESTING',
      baseFocusSeconds: 0,
      serverCurrentSessionSeconds: 0,
      serverReceivedAt: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('탭 복귀 시 정확한 시간이 표시된다', () => {
    // Given: FOCUSING 상태
    const now = new Date('2025-01-20T10:00:00Z').getTime();
    vi.setSystemTime(now);

    useFocusTimeStore.getState().syncFromServer({
      status: 'FOCUSING',
      totalFocusSeconds: 100,  // 이전 세션 누적
      currentSessionSeconds: 10,  // 현재 세션 10초 경과
    });

    // When: 60초 경과 시뮬레이션
    vi.setSystemTime(now + 60000);

    // Then: getFocusTime() = 100 (이전) + 10 (현재 세션) + 60 (클라이언트 경과) = 170
    expect(useFocusTimeStore.getState().getFocusTime()).toBe(170);
  });

  it('visibilitychange 이벤트 시 UI가 업데이트된다', () => {
    // Given: SocketManager 연결됨
    // When: visibilitychange 이벤트 발생
    document.dispatchEvent(new Event('visibilitychange'));

    // Then: updateFocusTime 호출됨
    expect(mockPlayer.updateFocusTime).toHaveBeenCalled();
  });

  it('disconnect 시 visibilitychange 핸들러가 정리된다', () => {
    // Given: SocketManager 연결됨
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    // When: disconnect
    socketManager.disconnect();

    // Then: 핸들러 제거됨
    expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});

// frontend/test/integration/task-timer.visibility.spec.ts
describe('TaskTimer - 탭 비활성화', () => {
  // ⚠️ 중요: Date.now() 기반 계산이므로 반드시 시스템 시간 모킹 필요
  beforeEach(() => {
    vi.useFakeTimers();

    // ✅ 테스트용 태스크 초기 상태 설정
    useTasksStore.setState({
      tasks: [
        { id: 1, description: 'Task 1', time: 0, baseTime: 0, startTimestamp: null, isRunning: false, completed: false },
        { id: 2, description: 'Task 2', time: 0, baseTime: 0, startTimestamp: null, isRunning: false, completed: false },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('탭 복귀 시 개별 태스크 시간이 정확하게 표시된다', () => {
    // Given: Task가 실행 중, startTimestamp 설정됨
    const now = new Date('2025-01-20T10:00:00Z').getTime();
    vi.setSystemTime(now);

    useTasksStore.getState().toggleTaskTimer(1);  // Task 시작

    // When: 60초 경과 시뮬레이션
    vi.setSystemTime(now + 60000);

    // Then: getTaskDisplayTime() = baseTime + 60
    const task = useTasksStore.getState().tasks.find(t => t.id === 1);
    const displayTime = task.baseTime + Math.floor((Date.now() - task.startTimestamp) / 1000);
    expect(displayTime).toBe(60);
  });

  it('태스크 정지 시 경과 시간이 time에 반영된다', () => {
    // Given: Task가 60초간 실행됨
    const now = new Date('2025-01-20T10:00:00Z').getTime();
    vi.setSystemTime(now);
    useTasksStore.getState().toggleTaskTimer(1);  // Task 시작

    vi.setSystemTime(now + 60000);

    // When: Task 정지
    useTasksStore.getState().toggleTaskTimer(1);

    // Then: time = 60, startTimestamp = null
    const task = useTasksStore.getState().tasks.find(t => t.id === 1);
    expect(task.time).toBe(60);
    expect(task.startTimestamp).toBeNull();
  });

  it('태스크 전환 시 기존 태스크의 경과 시간이 누적된다', () => {
    // Given: Task 1이 30초간 실행됨
    const now = new Date('2025-01-20T10:00:00Z').getTime();
    vi.setSystemTime(now);
    useTasksStore.getState().toggleTaskTimer(1);  // Task 1 시작

    vi.setSystemTime(now + 30000);  // 30초 경과

    // When: Task 2 시작 (Task 1은 자동 정지)
    useTasksStore.getState().toggleTaskTimer(2);

    // Then: Task 1의 time = 30, Task 2가 실행 중
    const tasks = useTasksStore.getState().tasks;
    const task1 = tasks.find(t => t.id === 1);
    const task2 = tasks.find(t => t.id === 2);

    expect(task1.isRunning).toBe(false);
    expect(task1.time).toBe(30);  // ✅ 경과 시간 누적됨
    expect(task1.startTimestamp).toBeNull();

    expect(task2.isRunning).toBe(true);
    expect(task2.startTimestamp).not.toBeNull();
  });
});
```

### 수동 검증 체크리스트

| # | 영역 | 시나리오 | 검증 방법 | 예상 결과 |
|---|------|---------|----------|----------|
| 1 | 전체 시간 | 탭 비활성화 60초 | 집중 시작 → 탭 전환 → 60초 대기 → 복귀 | 60초 이상 표시 |
| 2 | 전체 시간 | 브라우저 최소화 5분 | 집중 시작 → 최소화 → 5분 대기 → 복원 | 5분 이상 표시 |
| 3 | 전체 시간 | 새로고침 | 집중 중 새로고침 | 서버 시간 기준 복원 |
| 4 | 개별 태스크 | 탭 비활성화 60초 | Task 시작 → 탭 전환 → 60초 대기 → 복귀 | Task 시간 60초 이상 표시 |
| 5 | 개별 태스크 | 브라우저 최소화 5분 | Task 시작 → 최소화 → 5분 대기 → 복원 | Task 시간 5분 이상 표시 |
| 6 | 원격 플레이어 | 탭 전환 후 복귀 | A 집중, B 탭 전환 후 복귀 | A의 정확한 시간 표시 |
| 7 | 동기화 | 전체 + 개별 일치 | Task 시작 → 60초 → 정지 | 전체 시간 = 개별 Task 시간 |

### 검증 스크립트

```bash
# 1. 로컬 서버 실행
cd backend && pnpm start:dev &
cd frontend && pnpm dev &

# 2. 브라우저 열기 (Chrome DevTools 활성화)
open http://localhost:3000

# 3. 콘솔에서 모니터링
# (위의 디버깅용 콘솔 로그 실행)

# 4. 시나리오 실행 후 결과 확인
```

---

## 관련 이슈

- **#193** (나의 집중 시간이 다른 플레이어에게 낮게 표시됨)
  - 이 버그 수정으로 **부분 해결** 예상
  - 서버 기준 시간 계산으로 모든 클라이언트 동일한 값 표시

---

## 주의사항

### 1. cleanup 필수

```typescript
// ❌ 잘못된 예 - 메모리 누수
document.addEventListener('visibilitychange', handler);
// cleanup 없음

// ✅ 올바른 예
this.visibilityHandler = handler;
document.addEventListener('visibilitychange', this.visibilityHandler);

disconnect() {
  document.removeEventListener('visibilitychange', this.visibilityHandler);
}
```

### 2. 타입 정의

```typescript
// ❌ Node.js 전용 타입
timerInterval: NodeJS.Timeout | null;

// ✅ 브라우저 호환 타입
timerInterval: ReturnType<typeof setInterval> | null;
// 또는
timerInterval: number | null;
```

### 3. 서버 시간 신뢰

```typescript
// ❌ 클라이언트 시계에만 의존
const elapsed = Date.now() - clientStartTime;

// ✅ 서버 값 기준 + 클라이언트 보정
const elapsed = serverCurrentSessionSeconds + (Date.now() - serverReceivedAt) / 1000;
```

### 4. useMemo 의존성 (리뷰 반영)

```typescript
// ❌ baseFocusSeconds 누락 - RESTING 상태에서 갱신 시 UI 업데이트 안됨
const focusTimeDisplay = useMemo(() => {
  return getFocusTime();
}, [tick, status, getFocusTime]);

// ✅ baseFocusSeconds 포함
const focusTimeDisplay = useMemo(() => {
  return getFocusTime();
}, [tick, status, baseFocusSeconds, getFocusTime]);
```

### 5. 플레이어 이탈 시 캐시 정리 (리뷰 반영)

```typescript
// ❌ 이탈 시 정리 안 함 - 메모리 누수, 동일 ID 재사용 시 갱신 막힘
socket.on('player_left', (data) => {
  this.removePlayer(data.visitorId);
  // lastDisplayedRemoteSeconds 정리 안 함
});

// ✅ 이탈 시 캐시도 함께 정리
socket.on('player_left', (data) => {
  this.removePlayer(data.visitorId);
  this.scene.removeRemotePlayerCache(data.visitorId);  // ✅ 캐시 정리
});
```

### 6. 테스트 store 초기화 (리뷰 반영)

```typescript
// ❌ store 초기화 없음 - 테스트 순서 의존성 발생
beforeEach(() => {
  vi.useFakeTimers();
});

// ✅ store 초기화 포함 - 테스트 격리 보장
beforeEach(() => {
  vi.useFakeTimers();
  useFocusTimeStore.setState({
    status: 'RESTING',
    baseFocusSeconds: 0,
    serverCurrentSessionSeconds: 0,
    serverReceivedAt: 0,
  });
});
```

---

## 리뷰 반영 사항

| 우선순위 | 항목 | 수정 내용 | 관련 섹션 |
|---------|------|----------|----------|
| **Medium** | useMemo 의존성 | `baseFocusSeconds`를 selector와 의존성에 추가 | 4. TasksMenu.tsx |
| Low | 캐시 메모리 누수 | 플레이어 이탈 시 `removeRemotePlayerCache()` 호출 | 6. MapScene.update() |
| Low | 테스트 격리 | `beforeEach`에서 `useFocusTimeStore.setState()` 추가 | 자동화 테스트 |

---

## 완료된 작업 (2026-01-23)

### 1. 타임스탬프 기반 시간 계산

- `useFocusTimeStore`: `getFocusTime()` 함수에서 `baseFocusSeconds + serverCurrentSessionSeconds + clientElapsed` 계산
- `useTasksStore`: `getTaskDisplayTime()` 함수에서 `baseTime + (Date.now() - startTimestamp)` 계산
- `TasksMenu.tsx`: 타임스탬프 기반 렌더링으로 변경

### 2. 태스크 전환 버그 수정

- 이미 FOCUSING 상태에서 다른 태스크로 전환 시에도 서버에 `focusing` 이벤트 전송
- 이전 태스크의 집중 시간이 서버에 정상 저장됨

### 3. UTC 날짜 통일 (추가 발견 및 해결)

**문제:** 태스크 저장 시 로컬 날짜, 조회 시 UTC 날짜 사용으로 인한 불일치

| 동작 | 기존 | 변경 |
|------|------|------|
| 저장 (`createTask`) | `new Date()` (로컬) | `toISOString().slice(0, 10)` (UTC) |
| 조회 (`getTasks`) | `toISOString()` (UTC) | `toISOString().slice(0, 10)` (UTC) |

**변경 파일:**

| 파일 | 변경 내용 |
|------|----------|
| `task.entity.ts` | `createdDate`, `completedDate` 타입 `Date` → `string` |
| `task.service.ts` | UTC 날짜 문자열 저장 |
| `task.res.ts` | 불필요한 `new Date()` 변환 제거 |
| `task.service.spec.ts` | 타입 캐스팅 제거 |
| `DATABASE.md` | 날짜 타입 규칙 문서화 |

### 변경 파일 전체 목록

| 파일 | 변경 내용 |
|------|----------|
| `useFocusTimeStore.ts` | 타임스탬프 기반 `getFocusTime()`, 태스크 전환 시 emit 허용 |
| `useTasksStore.ts` | 타임스탬프 기반 `getTaskDisplayTime()`, `toggleTaskTimer()` |
| `TasksMenu.tsx` | 타임스탬프 기반 렌더링 |
| `RemotePlayer.ts` | 타임스탬프 기반 집중 시간 표시 |
| `focustime-store.spec.ts` | 테스트 업데이트 |
| `task.entity.ts` | `createdDate`, `completedDate` 타입 string으로 변경 |
| `task.service.ts` | UTC 날짜 문자열 저장 |
| `task.res.ts` | 불필요한 Date 변환 제거 |
| `task.service.spec.ts` | 타입 캐스팅 제거 |
| `DATABASE.md` | 날짜 타입 규칙 문서화 |
