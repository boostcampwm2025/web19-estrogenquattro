# 테스트 컨벤션

## 테스트 설명 스타일

테스트 설명은 **행위 중심 한글**로 작성합니다.

### 형식

```typescript
describe('기능/클래스명', () => {
  it('~하면 ~한다', async () => {
    // Given: 사전 조건
    // When: 테스트 대상 행위
    // Then: 검증
  });
});
```

### 예시

```typescript
describe('FocusTimeService', () => {
  describe('findOrCreate', () => {
    it('기존 레코드가 있으면 해당 레코드를 반환한다', async () => {
      // ...
    });

    it('기존 레코드가 없으면 새 레코드를 생성한다', async () => {
      // ...
    });
  });

  describe('startFocusing', () => {
    it('상태를 FOCUSING으로 변경한다', async () => {
      // ...
    });

    it('레코드가 없으면 NotFoundException을 던진다', async () => {
      // ...
    });
  });
});
```

---

## 테스트 구조

### Given-When-Then 패턴

모든 테스트는 **Given-When-Then 주석**을 반드시 포함합니다.

- **Given**: 사전 조건 (테스트 데이터 준비)
- **When**: 테스트 대상 행위 (실제 테스트 실행)
- **Then**: 검증 (결과 확인)

```typescript
it('YYYY-MM-DD 문자열로 저장한 레코드를 같은 형식의 문자열로 조회할 수 있다', async () => {
  // Given: 플레이어와 FocusTime 레코드 생성
  const player = await createTestPlayer('TestPlayer');
  const today = new Date().toISOString().slice(0, 10);
  const focusTime = focusTimeRepository.create({
    player,
    totalFocusMinutes: 0,
    status: FocusStatus.RESTING,
    createdDate: today as unknown as Date,
  });
  await focusTimeRepository.save(focusTime);

  // When: 같은 YYYY-MM-DD 문자열로 조회
  const found = await focusTimeRepository.findOne({
    where: {
      player: { id: player.id },
      createdDate: today as unknown as Date,
    },
  });

  // Then: 레코드를 찾을 수 있어야 함
  expect(found).toBeDefined();
  expect(found.id).toBe(focusTime.id);
});
```

### 소켓 이벤트 테스트 패턴

```typescript
it('focused 이벤트를 수신하면 해당 플레이어가 집중 상태로 변경된다', () => {
  // Given: 원격 플레이어가 존재하는 상태
  currentSocket.trigger("players_synced", [
    { userId: "remote-1", username: "alice", x: 0, y: 0, status: "RESTING" },
  ]);

  // When: focused 이벤트 수신
  currentSocket.trigger("focused", {
    userId: "remote-1",
    status: "FOCUSING",
    taskName: "코딩하기",
  });

  // Then: setFocusState가 올바른 인자로 호출됨
  const remote = remotePlayerInstances.get("remote-1");
  expect(remote?.setFocusState).toHaveBeenCalledWith(true, {
    taskName: "코딩하기",
  });
});
```

---

## 테스트 데이터베이스

### In-memory SQLite 사용

```typescript
beforeAll(async () => {
  module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        entities: [DailyFocusTime, Player],
        synchronize: true,
      }),
      TypeOrmModule.forFeature([DailyFocusTime, Player]),
    ],
    providers: [FocusTimeService],
  }).compile();
});

afterAll(async () => {
  await module.close();
});
```

### 테스트 격리

각 테스트는 독립적으로 실행되어야 합니다.

```typescript
beforeEach(async () => {
  // 각 테스트 전 데이터 초기화
  await focusTimeRepository.clear();
  await playerRepository.clear();
});
```

---

## 테스트 파일 명명

- 단위 테스트: `*.spec.ts`
- E2E 테스트: `*.e2e-spec.ts`

예시:
- `focustime.service.spec.ts`
- `task.controller.spec.ts`
- `auth.e2e-spec.ts`

---

## 프론트엔드 테스트

### 도구

- **테스트 러너:** Vitest
- **API 모킹:** MSW (Mock Service Worker)
- **위치:** `frontend/test/`

### 실행 명령어

```bash
cd frontend
pnpm test --run  # 단일 실행 (CI/CD, 스크립트용)
pnpm test        # 감시 모드 (기본값, 개발 중 사용)
```

> **주의:** `pnpm test`는 기본적으로 watch 모드로 실행됩니다.
> 한 번만 실행하고 종료하려면 `--run` 옵션을 사용하세요.

### MSW 핸들러

`frontend/test/mocks/handlers/` 디렉터리에 API 모킹 핸들러를 정의합니다.

```typescript
// frontend/test/mocks/handlers/tasks.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("*/api/tasks", ({ request }) => {
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? today();
    const tasks = taskStore.filter((t) => t.createdDate === date);
    return HttpResponse.json({ tasks });
  }),
];
```

### 통합 테스트 패턴

```typescript
describe("Tasks API 통합", () => {
  beforeEach(() => {
    resetTaskStore();
    useTasksStore.setState({ tasks: [], isLoading: false, error: null });
  });

  it("Task 목록을 조회하면 스토어에 반영된다", async () => {
    // Given: 테스트용 Task 시드
    seedTaskStore([buildTaskEntity({ id: 1, description: "테스트" })]);

    // When: fetchTasks 호출
    await useTasksStore.getState().fetchTasks();

    // Then: 스토어 상태 검증
    const state = useTasksStore.getState();
    expect(state.tasks).toHaveLength(1);
  });

  it("API 실패 시 에러 상태가 설정된다", async () => {
    // Given: 에러 응답 오버라이드
    server.use(
      http.get("*/api/tasks", () =>
        HttpResponse.json({ message: "error" }, { status: 500 }),
      ),
    );

    // When
    await useTasksStore.getState().fetchTasks();

    // Then
    expect(useTasksStore.getState().error).toBe("Task 목록을 불러오는데 실패했습니다.");
  });
});
```

### 테스트 파일 구조

```
frontend/test/
├── setup.ts                      # MSW 서버 설정
├── mocks/
│   ├── server.ts                 # MSW 서버 인스턴스
│   ├── socket-server.ts          # Socket.io 모킹
│   └── handlers/
│       └── tasks.ts              # Task API 핸들러
├── factories/
│   └── task.ts                   # 테스트 팩토리
└── integration/
    ├── tasks.api.spec.ts         # Task API 통합 테스트
    └── focus.socket.spec.ts      # FocusTime 소켓 테스트
```
