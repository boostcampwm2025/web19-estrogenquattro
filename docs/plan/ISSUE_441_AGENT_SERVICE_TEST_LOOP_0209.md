# 에이전트 실서비스 검증 루프 도입 계획

> 작성일: 2025-02-09
> 목적: AI 에이전트가 실제 서비스를 실행하고, CLI/소켓으로 상호작용하며, 로그를 읽어 검증하고 코드를 수정하는 자율 루프 도입

---

## 1. 목표 루프

### 서비스 구조

프론트엔드는 SSG 빌드 → `backend/public/`에서 서빙. **포트 8080 하나가 전체 서비스**.
에이전트 관점에서 프론트/백엔드 구분 없이, 하나의 서비스를 띄우고 검증한다.

```
pnpm build:all && cd backend && pnpm start:dev
  → localhost:8080
    ├─ REST API    (/auth/*, /api/*, /health, /metrics)
    ├─ WebSocket   (Socket.io)
    └─ 정적 파일   (/index.html, /assets/* — frontend SSG 결과물)
```

### 루프 흐름

```
코드 수정 (프론트든 백엔드든)
   ↓
빌드 + 서버 재시작
  ├─ 백엔드 수정: hot reload 자동 (~3초)
  └─ 프론트 수정: pnpm build:frontend → 서버 재시작 불필요 (정적 파일 교체)
   ↓
CLI로 검증 ─────────────────────────────────┐
  ├─ curl: REST API 호출 + 응답 확인         │
  ├─ curl: 정적 파일 서빙 확인               │
  ├─ socket client: 소켓 이벤트 송수신       │
  └─ multi-client: 멀티플레이어 시나리오      │
   ↓                                         │
서버 로그 읽기 ──────────────────────────────┤
  ├─ HTTP 요청/응답 로그                     │
  ├─ 소켓 이벤트 IN/OUT 로그                 │
  └─ 에러/경고 로그                          │
   ↓                                         │
판단: 성공? ─── Yes → 완료                   │
         └── No → 코드 재수정 ───────────────┘
```

**핵심 원칙**: 브라우저/스크린샷 없이, **CLI 출력 + 서버 로그**만으로 하나의 서비스 전체 동작을 검증한다.

---

## 2. 현재 상태 — 무엇이 가능하고 무엇이 막혀있는가

### 2-1. 가능한 것

| 항목 | 상태 | 상세 |
|------|------|------|
| 서버 시작 | `cd backend && pnpm start:dev` | hot reload, ~3초 재시작 |
| 서버 기동 확인 | 로그: `Nest application successfully started` | 명확 |
| 비인증 REST 호출 | `curl localhost:8080/health` | 즉시 가능 |
| 비인증 메트릭 | `curl localhost:8080/metrics` | Prometheus 포맷 |
| 로그 레벨 제어 | `LOG_LEVEL=debug pnpm start:dev` | Winston, 7단계 |
| DB 상태 유지 | SQLite 파일 기반 | 재시작해도 데이터 보존 |
| 에러 추적 | Winston 전역 예외 핸들러 | 스택트레이스 포함 |

### 2-2. 막혀있는 것

| 병목 | 심각도 | 설명 |
|------|--------|------|
| **인증 벽** | Critical | JWT 획득 = GitHub OAuth 브라우저 전용. CLI로 인증 불가 → 전체 API/소켓의 90% 차단 |
| **HTTP 요청/응답 로깅 없음** | High | Request logging middleware 없음. 어떤 요청이 들어오고 어떤 응답이 나갔는지 로그에 안 남음 |
| **소켓 emit 로깅 없음** | High | 서버→클라이언트 응답(emit) 내용 미로깅. 올바른 응답을 보냈는지 판단 불가 |
| **멀티 클라이언트 테스트 하네스 없음** | Medium | 여러 소켓 클라이언트 동시 시나리오 자동화 도구 부재 |
| **디버그 엔드포인트 없음** | Medium | 서버 내부 상태(방, 플레이어, 폴링) 조회 수단 없음. /health + /metrics만 존재 |
| **통합 검증 스크립트 없음** | Medium | `pnpm verify` 같은 원커맨드 없음. lint/typecheck/test를 각각 실행해야 함 |

### 2-3. 현재 로깅 상세도 (모듈별)

| 모듈 | 로깅 수준 | 비고 |
|------|-----------|------|
| GitHub 폴링 | ★★★★★ | 32+ 로그 포인트, 전 과정 추적 가능 |
| 인증 | ★★★★☆ | OAuth 콜백, JWT 생성, 쿠키 설정 로깅 |
| 플레이어 소켓 | ★★★★☆ | 연결/해제, 중복 세션 로깅 |
| 스케줄러 | ★★★★☆ | 정산 시작/종료, 플레이어별 포인트 |
| 포커스타임 | ★★★☆☆ | 이벤트 로깅 있으나 시간 계산 과정 미로깅 |
| 포인트 | ★★★☆☆ | 트랜잭션 시작/실행만 로깅 |
| 진행도 | ★★★☆☆ | GlobalState 복원/맵 전환 로깅 |
| 태스크 | ★★☆☆☆ | 생성만 로깅, 수정/삭제/조회 미로깅 |
| 채팅 | ★★☆☆☆ | 에러만 로깅, 정상 메시지 미로깅 |
| 맵 | ★★☆☆☆ | debug 레벨에서만 |

---

## 3. 구현 계획

### Phase 1: 인증 벽 제거 — 개발용 토큰 발급

> 모든 후속 Phase의 전제조건. 이것 없이는 실서비스 루프 불가.

#### 구현: `POST /auth/dev-login`

**파일**: `backend/src/auth/auth.controller.ts`

```typescript
@Post('dev-login')
async devLogin(@Body() body: { username: string }, @Res() res: Response) {
  // NODE_ENV !== 'development' 이면 404
  // username으로 Player 조회 (없으면 생성)
  // JWT 발급 → Set-Cookie: access_token
}
```

**조건**:
- `NODE_ENV=development`에서만 활성화
- 프로덕션 빌드에서 완전 비활성 (Guard 또는 조건부 라우트 등록)

**에이전트 사용법**:
```bash
# 1. 테스트 유저로 로그인 → 쿠키 저장
curl -X POST http://localhost:8080/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser"}' \
  -c cookies.txt

# 2. 이후 모든 요청에 쿠키 포함
curl -b cookies.txt http://localhost:8080/auth/me
curl -b cookies.txt -X POST http://localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"description":"test task"}'
```

**검증**: curl로 /auth/me 호출 → `{"githubId":..., "username":"testuser"}` 응답 확인

---

### Phase 2: HTTP 요청/응답 로깅 미들웨어

> 에이전트가 모든 API 동작을 로그만으로 추적 가능하게 함

#### 구현: `HttpLoggerMiddleware`

**신규 파일**: `backend/src/common/middleware/http-logger.middleware.ts`

```typescript
@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, body } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${duration}ms`,
        // body는 POST/PATCH만, 민감 정보 제외
      );
    });

    next();
  }
}
```

**등록**: `backend/src/app.module.ts`의 `configure()`에서 전역 적용

**제외 경로**: `/metrics` (고빈도), 정적 파일

**출력 예시**:
```
[HTTP] POST /auth/dev-login 201 5ms
[HTTP] GET /auth/me 200 2ms
[HTTP] POST /api/tasks 201 8ms {"description":"test task"}
[HTTP] DELETE /api/tasks/5 404 3ms
[HTTP] GET /api/github/events 200 15ms
```

**에이전트 활용**: curl 응답과 서버 로그를 교차 검증. 예상치 못한 요청이나 에러 상태 코드를 로그에서 즉시 발견.

---

### Phase 3: 소켓 이벤트 로깅 인터셉터

> 소켓 IN(클라이언트→서버) + OUT(서버→클라이언트) 양방향 로깅

#### 구현: 소켓 로깅 데코레이터 또는 게이트웨이 래퍼

**접근 A — 게이트웨이 공통 로깅 메서드**:

각 게이트웨이에서 emit 전에 로깅 유틸 호출:

```typescript
// backend/src/common/utils/socket-logger.ts
export function logSocketEmit(
  logger: Logger,
  event: string,
  target: string, // clientId 또는 roomId
  payload: unknown,
) {
  logger.debug(`EMIT ${event} → ${target}`, {
    payload: summarize(payload), // 큰 페이로드는 요약
  });
}

function summarize(payload: unknown): unknown {
  // 배열이면 길이만, 객체면 키 목록 + 일부 값
  if (Array.isArray(payload)) return `[${payload.length} items]`;
  return payload;
}
```

**접근 B — Socket.io 미들웨어**:

Socket.io의 서버 미들웨어로 모든 수신 이벤트 자동 로깅:

```typescript
// backend/src/config/socket-io.adapter.ts 내부 또는 별도 미들웨어
io.use((socket, next) => {
  socket.onAny((event, ...args) => {
    logger.debug(`← ${event} from ${socket.id}`, { args: summarize(args) });
  });
  // emit 래핑은 socket.emit을 프록시로 감싸기
  const originalEmit = socket.emit.bind(socket);
  socket.emit = (event: string, ...args: any[]) => {
    logger.debug(`→ ${event} to ${socket.id}`, { args: summarize(args) });
    return originalEmit(event, ...args);
  };
  next();
});
```

**출력 예시**:
```
[Socket] ← joining from skt_abc123 {"x":10,"y":20,"username":"testuser"}
[Socket] → joined to skt_abc123 {"userId":1,"roomId":"room1","status":"RESTING"}
[Socket] → players_synced to skt_abc123 [3 items]
[Socket] ← focusing from skt_abc123 {"taskName":"코드 리뷰"}
[Socket] → focused to room:room1 {"userId":1,"status":"FOCUSING","taskName":"코드 리뷰"}
```

**고빈도 이벤트 처리**: `moving` 이벤트는 초당 30회+ 발생 가능 → `LOG_LEVEL=verbose` 이상에서만 로깅, 또는 샘플링(10번째마다)

**에이전트 활용**: 소켓 이벤트 전송 후 서버 로그에서 IN/OUT 쌍을 확인. "joining을 보냈는데 joined가 안 왔다" 같은 문제를 즉시 발견.

---

### Phase 4: 멀티 소켓 클라이언트 테스트 하네스

> 에이전트가 멀티플레이어 시나리오를 CLI에서 자동화할 수 있게 하는 테스트 러너

#### 구현: `backend/scripts/socket-test-harness.ts`

```typescript
import { io, Socket } from 'socket.io-client';

const BASE_URL = 'http://localhost:8080';

interface TestClient {
  name: string;
  socket: Socket;
  received: Map<string, any[]>; // 이벤트별 수신 내역
}

async function getDevToken(username: string): Promise<string> {
  // POST /auth/dev-login → Set-Cookie에서 JWT 추출
}

async function createClient(username: string): Promise<TestClient> {
  const token = await getDevToken(username);
  const socket = io(BASE_URL, {
    extraHeaders: { Cookie: `access_token=${token}` },
  });
  const received = new Map<string, any[]>();

  socket.onAny((event, data) => {
    if (!received.has(event)) received.set(event, []);
    received.get(event)!.push(data);
    console.log(`[${username}] ← ${event}`, JSON.stringify(data).slice(0, 200));
  });

  return { name: username, socket, received };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- 시나리오 ---

async function scenario_multiJoin() {
  console.log('\n=== 시나리오: 3명 동시 입장 ===');

  const clients = await Promise.all([
    createClient('player1'),
    createClient('player2'),
    createClient('player3'),
  ]);

  // 3명 모두 joining
  clients.forEach((c, i) => {
    c.socket.emit('joining', { x: i * 50, y: 100, username: c.name });
  });

  await sleep(2000);

  // 검증: 각 클라이언트가 players_synced를 수신했는가
  for (const c of clients) {
    const synced = c.received.get('players_synced');
    console.log(`[${c.name}] players_synced 수신: ${synced ? synced.length + '회' : '없음'}`);
  }

  // 정리
  clients.forEach((c) => c.socket.disconnect());
  console.log('=== 시나리오 완료 ===\n');
}

async function scenario_focusBroadcast() {
  console.log('\n=== 시나리오: focusing 브로드캐스트 ===');

  const [alice, bob] = await Promise.all([
    createClient('alice'),
    createClient('bob'),
  ]);

  // 둘 다 입장
  alice.socket.emit('joining', { x: 10, y: 20, username: 'alice' });
  bob.socket.emit('joining', { x: 30, y: 40, username: 'bob' });
  await sleep(1000);

  // alice가 focusing
  alice.socket.emit('focusing', { taskName: '테스트 태스크' });
  await sleep(1000);

  // 검증: bob이 focused 이벤트를 수신했는가
  const bobFocused = bob.received.get('focused');
  console.log(`[bob] focused 수신: ${bobFocused ? JSON.stringify(bobFocused[0]) : '없음'}`);

  alice.socket.disconnect();
  bob.socket.disconnect();
  console.log('=== 시나리오 완료 ===\n');
}

// 실행
async function main() {
  await scenario_multiJoin();
  await scenario_focusBroadcast();
  process.exit(0);
}

main().catch(console.error);
```

**실행 스크립트** (`backend/package.json`):
```json
"test:socket": "tsx scripts/socket-test-harness.ts"
```

**에이전트 사용법**:
```bash
# 1. 서버 시작 (별도 터미널/백그라운드)
cd backend && pnpm start:dev &

# 2. 멀티 클라이언트 시나리오 실행
cd backend && pnpm test:socket

# 출력:
# === 시나리오: 3명 동시 입장 ===
# [player1] ← joined {"userId":1,"roomId":"room1",...}
# [player2] ← joined {"userId":2,"roomId":"room1",...}
# [player3] ← joined {"userId":3,"roomId":"room1",...}
# [player1] ← players_synced [3 items]
# [player1] players_synced 수신: 3회
# [player2] players_synced 수신: 2회
# [player3] players_synced 수신: 1회
# === 시나리오 완료 ===
```

**확장**: 에이전트가 시나리오를 추가/수정하여 새 기능을 검증할 수 있음.
새 시나리오 함수를 작성하고 main()에 추가하면 됨.

**검증 가능한 멀티플레이어 시나리오**:

| 시나리오 | 검증 내용 |
|----------|-----------|
| 3명 동시 입장 | players_synced에 모든 플레이어 포함 |
| focusing 브로드캐스트 | 같은 방 다른 플레이어가 focused 수신 |
| 입장 → 퇴장 → 재입장 | player_left + player_joined 순서 |
| 중복 세션 | 같은 유저 2번째 연결 시 session_replaced |
| 채팅 | chatted 이벤트 다른 플레이어에게 전달 |
| 맵 진행 | progress_update 이벤트 브로드캐스트 |

---

### Phase 5: 디버그 엔드포인트

> 에이전트가 서버 내부 상태를 curl로 조회할 수 있게 함

#### 구현: `DebugController` (개발 모드 전용)

**신규 파일**: `backend/src/debug/debug.controller.ts`

```
GET  /debug/state
  → 전체 서버 상태 스냅샷
  {
    "rooms": [{"id":"room1","players":3}],
    "connectedSockets": 3,
    "globalState": {"progress":45,"mapIndex":1},
    "pollingActive": ["player1","player2"]
  }

GET  /debug/players
  → 접속 중인 플레이어 상세
  [
    {"socketId":"skt_abc","username":"player1","status":"FOCUSING","roomId":"room1"},
    ...
  ]

POST /debug/mock-github-event
  → 가짜 GitHub 이벤트 주입 (폴링 없이 즉시 테스트)
  Body: {"username":"player1","type":"PushEvent","commits":3}
  → progress_update 이벤트 발생 확인
```

**조건**: `NODE_ENV=development`에서만 모듈 등록 (ConditionalModule 또는 동적 모듈)

**에이전트 활용**:
```bash
# 코드 수정 후 서버 상태 스냅샷 확인
curl -b cookies.txt http://localhost:8080/debug/state | jq .

# GitHub 이벤트 시뮬레이션 (실제 GitHub 커밋 없이)
curl -b cookies.txt -X POST http://localhost:8080/debug/mock-github-event \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","type":"PushEvent","commits":3}'
```

---

### Phase 6: 원커맨드 서비스 검증

> 빌드 + 단위 테스트 + 정적 분석을 하나의 서비스 관점에서 원커맨드로

**루트 `package.json`에 추가**:
```json
{
  "verify": "pnpm build:all && pnpm lint:all && pnpm typecheck && pnpm test:all",
  "verify:quick": "pnpm typecheck && pnpm test:all",
  "lint:all": "cd backend && pnpm lint && cd ../frontend && pnpm lint",
  "typecheck": "cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit",
  "test:all": "cd backend && pnpm test && cd ../frontend && pnpm test"
}
```

**각 하위 `package.json`에 추가**:
```json
"typecheck": "tsc --noEmit"
```

**에이전트 관점**: 내부적으로 backend/frontend 디렉토리를 오가지만, 에이전트는 루트에서 원커맨드로 실행. 서비스 전체가 빌드되고 검증된다.

```
코드 수정 → pnpm verify (서비스 전체 정적 검증) → 실서비스 루프 (동적 검증)
         또는
코드 수정 → pnpm verify:quick (빌드 제외, 빠른 검증) → 실서비스 루프
```

---

## 4. 구현 순서 및 의존성

```
Phase 6: 원커맨드 검증 ← 완전 독립. 가장 먼저 적용 가능
   ↓
Phase 1: 인증 우회     ← 실서비스 루프의 전제조건. Phase 4, 5에 필요
   ↓
Phase 2: HTTP 로깅     ← Phase 1과 독립. 병렬 가능
Phase 3: 소켓 로깅     ← Phase 1과 독립. 병렬 가능
   ↓
Phase 4: 소켓 하네스   ← Phase 1 완료 후 가능 (dev-login 사용)
Phase 5: 디버그 API    ← Phase 1 완료 후 가능
```

**최소 유효 구현**: Phase 6 + 1 + 2만으로 에이전트 루프 기본 동작 가능
**풀 구현**: Phase 1~6 전체 적용 시 멀티플레이어 시나리오까지 자동화

---

## 5. Phase별 예상 작업량

| Phase | 신규 파일 | 수정 파일 | 예상 코드량 | 난이도 |
|-------|-----------|-----------|-------------|--------|
| 1. 인증 우회 | 0 | auth.controller.ts, auth.module.ts | ~30줄 | 낮음 |
| 2. HTTP 로깅 | http-logger.middleware.ts | app.module.ts | ~40줄 | 낮음 |
| 3. 소켓 로깅 | socket-logger.ts | socket-io.adapter.ts 또는 각 gateway | ~50줄 | 중간 |
| 4. 소켓 하네스 | scripts/socket-test-harness.ts | package.json | ~150줄 | 중간 |
| 5. 디버그 API | debug.controller.ts, debug.module.ts | app.module.ts | ~80줄 | 중간 |
| 6. 원커맨드 검증 | 0 | package.json (루트, backend, frontend) | ~10줄 | 낮음 |

**총합**: 신규 4파일, 수정 6~8파일, ~360줄

---

## 6. 개선 후 에이전트 루프 전체 시나리오

### 시나리오 A: "태스크 완료 시 포인트 적립 로직 수정"

```bash
# 0. 서비스가 백그라운드에서 실행 중 (localhost:8080)

# 1. 에이전트가 코드 수정
# → backend/src/point/point.service.ts 편집

# 2. 서비스 전체 정적 검증
pnpm verify:quick
# → typecheck ✅, unit test ✅

# 3. 서버 hot reload 대기 → 로그 확인
# 로그: [NestApplication] Nest application successfully started

# 4. 인증 (한 번만 — 이후 쿠키 재사용)
curl -X POST localhost:8080/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser"}' -c cookies.txt

# 5. API 동작 확인 (curl 응답 + 서버 로그 교차 검증)
curl -b cookies.txt -X POST localhost:8080/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"description":"test task"}'
# curl 응답: {"id":1,"description":"test task","playerId":1}
# 서버 로그: [HTTP] POST /api/tasks 201 8ms
# 서버 로그: [TaskService] Task created {"taskId":1,"playerId":1}

# 6. 멀티플레이어 시나리오 — 포커스 → 포인트 적립 검증
pnpm test:socket
# 출력: [testuser] ← focused {"status":"FOCUSING","taskName":"test task"}
# 출력: [testuser] ← rested {"totalFocusSeconds":60}
# 서버 로그: [Socket] ← focusing from skt_abc {"taskName":"test task"}
# 서버 로그: [Socket] → focused to room:room1 {"userId":1,"status":"FOCUSING"}
# 서버 로그: [PointService] TX START addPoint {"playerId":1,"type":"task_complete"}

# 7. 서버 내부 상태 확인
curl -b cookies.txt localhost:8080/debug/state | jq .
# → {"rooms":[...],"globalState":{"progress":47,...}}

# 8. 에러 없음 + 기대 동작 확인 → 완료
# (에러 발견 시 → 1번으로 돌아감)
```

### 시나리오 B: "프론트엔드 정적 파일 수정 후 서빙 확인"

```bash
# 1. 프론트엔드 코드 수정
# → frontend/src/app/_components/... 편집

# 2. 서비스 전체 빌드 (프론트 SSG → backend/public/)
pnpm build:frontend

# 3. 정적 파일이 서빙되는지 확인 (서버 재시작 불필요)
curl -s localhost:8080/ | head -20
# → <!DOCTYPE html>... (빌드된 index.html)
# 서버 로그: [HTTP] GET / 200 2ms

curl -s -o /dev/null -w "%{http_code}" localhost:8080/assets/some-chunk.js
# → 200
```

---

## 7. 한계 — 이 루프로 검증할 수 없는 것

| 영역 | 이유 | 대안 |
|------|------|------|
| UI 렌더링 결과 | HTML/CSS/Canvas는 CLI로 볼 수 없음 | Playwright E2E (장기) |
| Phaser 게임 화면 | Canvas 렌더링 결과물 | 스크린샷 기반 (비용 높음) |
| CSS/레이아웃 | 시각적 요소 | 브라우저 수동 확인 |
| 브라우저 런타임 상태 | Zustand 스토어, React 상태 등 | 단위 테스트 (Vitest + RTL) |

**결론**: 이 루프는 **하나의 서비스(localhost:8080)에서 제공하는 API + 소켓 + 정적 파일 서빙**을 CLI로 통합 검증한다. 시각적 UI 검증만이 유일한 사각지대이며, 이는 기존 컴포넌트 단위 테스트로 보완한다.
