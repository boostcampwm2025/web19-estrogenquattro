# 부하 테스트 환경 구축 계획

- **이슈**: #467
- **목표**: 서버 동시 접속자 수용 한계 측정 (Socket.io + GitHub 폴링 + DB I/O)

---

## 브랜치 전략

부하 테스트는 **서버 코드 변경**(UserStore 시딩 엔드포인트, 환경변수 분리 등)이 필요합니다.
이 변경은 프로덕션에 포함되면 안 되므로 **전용 브랜치**에서 작업합니다.

```
main ─────────────────────────────── (프로덕션, 변경 없음)
  │
  └── load-test ─────────────────── (부하 테스트 전용)
        ├── 서버 코드 변경 (Step 0)
        ├── load-test/ 디렉토리 (Step 1~4)
        └── 테스트 완료 후 → main에 머지하지 않음
```

| 항목 | 브랜치 | 비고 |
|------|--------|------|
| UserStore 시딩 엔드포인트 | `load-test` | main에 머지 금지 |
| GITHUB_API_BASE_URL 환경변수 분리 | `load-test` → 추후 main에 cherry-pick 가능 | 프로덕션에도 유용할 수 있음 |
| POLL_INTERVAL_MS 환경변수 분리 | `load-test` → 추후 main에 cherry-pick 가능 | 동일 |
| load-test/ 디렉토리 | `load-test` | 테스트 도구, main 불필요 |

> **테스트 결과 보존**: 테스트 완료 후 `load-test/results/`에 결과를 커밋하고 브랜치를 보존합니다. main에는 머지하지 않습니다.

---

## 실행 기준 디렉토리

> **머신 A의 서버 관련 명령어는 `backend/` 디렉토리에서 실행합니다.**
>
> NestJS 서버, DB 파일, 환경변수가 모두 `backend/` 기준이므로 통일합니다.
> 루트 `package.json`에는 `start:dev`가 없고, DB 경로 `data/jandi.sqlite`도 `backend/` 상대 경로입니다.
>
> **머신 B**의 k6/Mock 서버는 저장소 clone 후 `load-test/` 디렉토리에서 실행합니다.

```bash
# 머신 A 작업 시작 시
cd backend

# 머신 B 작업 시작 시 (저장소 clone 후)
cd ~/web19-estrogenquattro/load-test
```

---

## 테스트 환경 구성 (머신 분리)

서버 성능을 정확히 측정하기 위해 **서버와 테스트 도구를 별도 머신**에서 실행합니다.

```
┌──────────────────────────────────┐        ┌──────────────────────────────┐
│   머신 A: 테스트 대상              │        │   머신 B: 테스트 도구          │
│                                  │        │                              │
│   NestJS 서버 (8080)              │◄──────│   k6 (부하 생성, ~500MB)      │
│   SQLite DB (backend/data/       │  WS    │   GitHub Mock 서버 (9090)     │
│              jandi.sqlite)       │  HTTP  │                              │
│   토큰 생성 스크립트               │──────►│                              │
│   (100% 리소스 사용)              │ 폴링   │                              │
└──────────────────────────────────┘        └──────────────────────────────┘
```

| 구성요소 | 머신 | 이유 |
|---------|------|------|
| NestJS 서버 | A | 측정 대상, 리소스 100% 확보 |
| k6 (70 VU) | B | ~300-500MB + CPU 사용, 서버에 영향 주면 안 됨 |
| GitHub Mock | B | 경량 (~20MB), k6와 같은 머신에서 충분 |
| generate-tokens.ts | A | DB 파일(`backend/data/jandi.sqlite`)이 머신 A 로컬이므로 머신 A에서 실행 |
| 모니터링 | A | Prometheus + 보조 스크립트 |

**서버 환경변수 설정:**

```env
# 머신 A: backend/.env.local (load-test 브랜치)
# 기존 필수 변수 (서버 부팅에 필요, env.validation.ts 참조)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
JWT_SECRET=your_jwt_secret_key_must_be_at_least_32_characters_long

# 부하 테스트 추가 변수
GITHUB_API_BASE_URL=http://머신B_IP:9090
POLL_INTERVAL_MS=10000
LOAD_TEST_SECRET=your-random-secret-here
LOG_LEVEL=warn
```

> **전제**: 기존 `.env.local`에 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `JWT_SECRET`가 설정되어 있어야 합니다. 없으면 서버 부팅 시 validation 에러로 실패합니다.
>
> **주의**: `NODE_ENV=production` 설정 시 `AXIOM_TOKEN`, `AXIOM_DATASET`도 필수입니다 (`env.validation.ts`의 Joi `.when()` 조건). 부하 테스트에서는 `NODE_ENV`를 설정하지 않으므로 (기본값 undefined) Axiom 변수는 불필요합니다. **`NODE_ENV=production`을 설정하지 마세요.**
>
> **LOG_LEVEL=warn 필수**: non-production 기본 로그 레벨은 `debug`입니다 (`backend/src/config/logger.winston.ts:13`). 폴링 루프에만 debug 로그가 17건 이상 있어 (`github.poll-service.ts:335,398,424` 등), 70 VU × 10초 폴링 시 초당 수백 건의 콘솔 I/O가 발생합니다. 이 오버헤드로 부하 테스트 결과가 과소평가될 수 있으므로 `LOG_LEVEL=warn` 이상으로 설정하세요.

**네트워크 요건:**
- 머신 A ↔ 머신 B: 같은 네트워크 (LAN 또는 같은 VPC)
- 지연: <5ms 권장 (실제 GitHub API 지연은 Mock에서 시뮬레이션)

---

## 현재 서버 방 입장 상한

| 항목 | 값 | 근거 |
|------|---|------|
| 방 수 | 5개 (room-1 ~ room-5) | `room.service.ts` 고정 |
| 방당 인원 | 14명 | capacity 하드코딩 |
| **최대 방 입장** | **70명** | 5 × 14 |

> **WS 연결 vs 방 입장 구분**: 방이 꽉 차면 `join_failed` 이벤트만 전송하고 **소켓 연결은 유지**됩니다 (`player.gateway.ts:144-155`). 즉 70명 초과 WS 연결도 가능하지만, 방에 입장한 플레이어는 최대 70명입니다.
>
> 테스트에서는 두 지표를 분리하여 측정합니다:
> - **WS 연결 성공**: Socket.io 핸드셰이크 + CONNECT 완료
> - **Joining 성공**: `joining` 이벤트 전송 후 `join_failed` 미수신 (방 배정 완료)

---

## 전제 조건 변경사항 (Step 0: 서버 코드 변경)

> 모든 변경은 `load-test` 브랜치에서 수행합니다.

### 0-1. UserStore 시딩 엔드포인트 (필수)

**문제**: WebSocket 인증 흐름에서 JWT 검증 후 `UserStore.findByGithubId()`를 호출합니다.
UserStore는 **인메모리 Map**이며, `GithubStrategy.validate()` (OAuth 로그인 시)에만 채워집니다.
DB에 유저를 넣고 JWT를 만들어도 UserStore에 없으면 `verifyClient()`가 false → 즉시 disconnect.

```
WsJwtGuard.verifyClient() (ws-jwt.guard.ts:38-65)
  → extractToken(cookie)
  → jwtService.verify(token)
  → userStore.findByGithubId(payload.sub)  ← UserStore에 없으면 실패
```

**해결**: 시크릿 기반 가드가 있는 테스트 전용 엔드포인트로 UserStore를 직접 시딩

**변경 대상**: `backend/src/auth/auth.controller.ts`

현재 컨트롤러에 없는 import/DI를 추가해야 합니다:

```typescript
// import 추가 (기존: Controller, Get, Logger, Req, Res, UseGuards)
import { Body, Controller, ForbiddenException, Get, Headers, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import { UserStore } from './user.store';

// constructor에 UserStore 주입 추가
constructor(
  private jwtService: JwtService,
  private configService: ConfigService,
  private userStore: UserStore,   // 추가
) {}
```

```typescript
// load-test 브랜치 전용 엔드포인트 — 시크릿 가드 포함
@Post('test-seed-users')
async seedTestUsers(
  @Headers('x-load-test-secret') secret: string,
  @Body() body: { users: Array<{ githubId: string; username: string; accessToken: string; playerId: number }> },
) {
  const expected = this.configService.get<string>('LOAD_TEST_SECRET');
  if (!expected || secret !== expected) {
    throw new ForbiddenException('Invalid load test secret');
  }

  for (const user of body.users) {
    this.userStore.save({
      githubId: user.githubId,
      username: user.username,
      avatarUrl: '',
      accessToken: user.accessToken,
      playerId: user.playerId,
    });
  }
  return { seeded: body.users.length };
}
```

**보안 계층:**
- `LOAD_TEST_SECRET` 환경변수가 없으면 항상 403 → 프로덕션에서 실수로 호출해도 차단
- 브랜치 분리 + 시크릿 가드 이중 보호

**토큰 생성 스크립트에서 호출 흐름:**

```
1. DB에 테스트 유저 INSERT (social_id = 숫자)
2. JWT 토큰 생성 (sub = githubId 문자열)
3. POST /auth/test-seed-users 호출 (x-load-test-secret 헤더 포함) → UserStore에 유저 등록
4. 이후 WebSocket 연결 시 verifyClient() 통과
```

### 0-2. GitHub API URL 환경변수 분리 (필수)

현재 `github.poll-service.ts`에 3곳 하드코딩 상태. Mock 서버로 전환하려면 환경변수화 필요.

**변경 대상 3개 파일:**

#### (a) `backend/src/config/env.validation.ts` — 환경변수 스키마 추가

```typescript
// 기존 스키마에 추가
GITHUB_API_BASE_URL: Joi.string()
  .default('https://api.github.com')
  .optional(),
POLL_INTERVAL_MS: Joi.number()
  .default(120000)
  .optional(),
LOAD_TEST_SECRET: Joi.string()
  .optional(),
```

#### (b) `backend/src/github/github.poll-service.ts` — ConfigService 주입 + URL 치환

현재 constructor에 ConfigService가 없으므로 주입 추가:

```typescript
// 변경 전 (line 142-146)
constructor(
  private readonly progressGateway: ProgressGateway,
  private readonly githubService: GithubService,
  private readonly pointService: PointService,
) {}

// 변경 후
constructor(
  private readonly configService: ConfigService,
  private readonly progressGateway: ProgressGateway,
  private readonly githubService: GithubService,
  private readonly pointService: PointService,
) {}
```

클래스 레벨 getter로 baseUrl을 공유하여 3개 메서드에서 일관되게 사용:

```typescript
// 클래스 레벨 getter (3개 메서드에서 공유)
private get githubApiBaseUrl(): string {
  return this.configService.get<string>('GITHUB_API_BASE_URL') ?? 'https://api.github.com';
}

private get pollInterval(): number {
  return this.configService.get<number>('POLL_INTERVAL_MS') ?? 120_000;
}
```

3개 메서드 각각에서 getter 사용 (서로 다른 private 메서드에 위치):

```typescript
// pollGithubEvents() (line 312)
const url = `${this.githubApiBaseUrl}/users/${username}/events/public?per_page=100`;

// getCommitDetails() (line 782)
const url = `${this.githubApiBaseUrl}/repos/${repoName}/compare/${before}...${head}`;

// getPrTitle() (line 821)
const url = `${this.githubApiBaseUrl}/repos/${repoName}/pulls/${prNumber}`;
```

> **주의**: 3개 URL이 **서로 다른 private 메서드**(`pollGithubEvents`, `getCommitDetails`, `getPrTitle`)에 있습니다. 클래스 레벨 getter를 사용하면 누락 없이 일괄 치환할 수 있습니다.

POLL_INTERVAL_MS 사용처도 기존 상수 참조를 getter로 변경:

```typescript
// 변경 전 (line 9 상수 + 사용처)
const POLL_INTERVAL = 120_000;
// ... this.scheduleNextPoll(username, POLL_INTERVAL);

// 변경 후
// ... this.scheduleNextPoll(username, this.pollInterval);
```

#### (c) `backend/src/github/github.module.ts` — ConfigModule import 확인

ConfigModule이 이미 전역이면 불필요. 아닐 경우 imports에 추가.

### 0-3. .gitignore에 토큰 파일 추가 (필수)

`tokens.json`에는 JWT 토큰과 액세스 토큰이 포함되므로 **절대 커밋되면 안 됩니다.**

```gitignore
# .gitignore에 추가 (load-test 브랜치에서)
load-test/tokens.json
```

---

## 구현 항목

### Step 1: GitHub Mock 서버

실제 GitHub REST Events API와 동일한 응답을 반환하는 Mock 서버.

**위치**: `load-test/github-mock-server.js`
**의존성**: Node.js 내장 `http` 모듈만 사용 (외부 패키지 불필요, `npm install` 없이 실행 가능)

**구현할 엔드포인트 3개:**

| 엔드포인트 | 용도 |
|-----------|------|
| `GET /users/:username/events/public` | 이벤트 목록 (PushEvent, PullRequestEvent 등) |
| `GET /repos/:owner/:repo/compare/:base...:head` | 커밋 상세 (Compare API) |
| `GET /repos/:owner/:repo/pulls/:number` | PR 제목 조회 |

**핵심 동작:**

- 50~200ms 랜덤 지연 (실제 GitHub API 시뮬레이션)
- ETag 지원 (첫 요청 → 200 + ETag, 이후 → 304 Not Modified)
- **2가지 모드** (환경변수 `MOCK_MODE`로 전환):
  - `silent` (기본값): **첫 요청만 200 (baseline용), 이후 304 반환** — Phase 1용. DB 쓰기 0건
  - `spike`: **N번째 폴링마다 새 이벤트 반환** — Phase 2 전용. DB 쓰기 스파이크 유발
- Rate Limit 헤더 포함 (`X-RateLimit-Remaining`)
- **첫 폴링 baseline 인지**: 서버의 첫 폴링은 baseline만 설정하고 이벤트를 처리하지 않음. `spike` 모드에서는 매 요청에 동일하게 응답하되, 새 이벤트 반환 시점을 N번째 폴링으로 제어

**모드별 동작:**

| 모드 | 첫 요청 | 이후 요청 | 용도 |
|------|---------|----------|------|
| `silent` | 200 + ETag + 이벤트 (baseline용) | 항상 304 Not Modified | Phase 1 — 폴링 DB 쓰기 격리 |
| `spike` | 200 + ETag + 이벤트 (baseline용) | N번째마다 ETag 변경 + 새 이벤트 | Phase 2 — DB 동시 쓰기 측정 |

```bash
# Phase 1: Mock 서버 필수 실행 — 접속 1초 후 baseline 폴링 1회/유저가 발생함
# (silent 모드: 첫 요청 200으로 baseline 제공, 이후 304 반환하여 DB 쓰기 차단)
node github-mock-server.js

# Phase 2: spike 모드 — 폴링 시 새 이벤트 반환하여 DB 쓰기 스파이크 유발
MOCK_MODE=spike node github-mock-server.js
```

**Mock 응답 예시 (PushEvent):**

```json
[
  {
    "id": "evt-{timestamp}",
    "type": "PushEvent",
    "actor": { "id": 12345, "login": "loadtest-user-1" },
    "repo": { "id": 1, "name": "loadtest-org/test-repo" },
    "payload": {
      "before": "abc123",
      "head": "def456",
      "size": 1,
      "commits": [{ "sha": "def456", "message": "feat: load test commit" }]
    },
    "created_at": "2026-02-11T10:00:00Z"
  }
]
```

---

### Step 2: 테스트용 JWT 토큰 생성 + DB 시딩 스크립트

**위치**: `load-test/generate-tokens.ts`, `load-test/seed-test-users.sql`

> **실행 위치: 머신 A의 `backend/` 디렉토리** — DB 파일(`data/jandi.sqlite`)이 머신 A 로컬의 `backend/data/`에 있으므로, DB 접근이 필요한 스크립트는 머신 A에서 실행합니다. 생성된 `tokens.json`은 머신 B로 복사합니다.

#### (a) DB 시딩 — players 테이블에 INSERT

`social_id`는 `bigint` 타입이므로 **숫자 ID** 사용.
반복 실행 시 unique 제약 위반을 방지하기 위해 `INSERT OR IGNORE` 사용:

```sql
-- load-test/seed-test-users.sql
INSERT OR IGNORE INTO players (social_id, nickname, total_point)
VALUES (-1, 'loadtest-user-1', 10000),
       (-2, 'loadtest-user-2', 10000),
       (-3, 'loadtest-user-3', 10000),
       -- ... 70명까지
       (-70, 'loadtest-user-70', 10000);
```

> **`total_point = 10000` 근거**: 펫 가챠 비용이 100 포인트(`pet.service.ts:36`), 먹이주기 비용이 10 포인트(`pet.service.ts:157`)입니다.
> Phase 1에서 VU당 약 1~2회 펫 상호작용(5% 확률)이 발생하므로 10000 포인트면 충분합니다.
> Phase 1에서 GitHub 폴링이 비활성화되어 포인트 획득 경로가 제한적(태스크 완료 +1)이므로, 시드 포인트가 부족하면 펫 관련 DB write가 전혀 발생하지 않아 부하 모델이 왜곡됩니다.

> `social_id`는 **음수** 사용으로 실제 GitHub 유저와 충돌 불가능을 보장합니다.
> GitHub user ID는 양의 정수이므로 음수 범위는 절대 충돌하지 않습니다.

#### (b) JWT 토큰 생성

서버의 JWT_SECRET을 사용하여 N명의 가짜 유저 토큰을 생성.

```typescript
// JWT payload 구조 (실제 서버와 동일: auth.controller.ts:35-39)
{
  sub: "-1",              // githubId (문자열, social_id와 대응)
  username: "loadtest-user-1",
  playerId: 1,                   // DB INSERT 후 조회한 실제 ID
  iat: now,
  exp: now + 86400               // 24시간 (서버 설정과 동일)
}
```

**실행 절차 (머신 A, `backend/` 디렉토리에서):**

```bash
# 1. DB 시딩 (backend/ 기준 상대 경로)
sqlite3 data/jandi.sqlite < ../load-test/seed-test-users.sql

# 2. 토큰 생성 + UserStore 시딩
LOAD_TEST_SECRET=your-random-secret-here npx ts-node ../load-test/generate-tokens.ts

# 3. 생성된 토큰 파일을 머신 B로 복사
scp ../load-test/tokens.json 머신B_IP:~/web19-estrogenquattro/load-test/tokens.json
```

**출력**: `load-test/tokens.json` — k6 스크립트에서 읽어서 사용

```json
[
  { "githubId": "-1", "username": "loadtest-user-1", "playerId": 1, "token": "eyJ...", "accessToken": "fake-gh-token-1" },
  { "githubId": "-2", "username": "loadtest-user-2", "playerId": 2, "token": "eyJ...", "accessToken": "fake-gh-token-2" }
]
```

#### (c) UserStore 시딩 호출

`generate-tokens.ts`의 마지막 단계에서 서버의 시딩 엔드포인트를 호출:

```typescript
// generate-tokens.ts 내부 — 머신 A 로컬에서 실행
const LOAD_TEST_SECRET = process.env.LOAD_TEST_SECRET;

const res = await fetch('http://localhost:8080/auth/test-seed-users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-load-test-secret': LOAD_TEST_SECRET,
  },
  body: JSON.stringify({
    users: tokens.map(t => ({
      githubId: t.githubId,
      username: t.username,
      accessToken: t.accessToken,   // Mock 서버가 아무 토큰이나 수용
      playerId: t.playerId,
    })),
  }),
});

if (!res.ok) {
  const body = await res.text();
  console.error(`UserStore 시딩 실패: ${res.status} ${res.statusText}\n${body}`);
  process.exit(1);
}
const result = await res.json();
console.log(`UserStore 시딩 완료: ${result.seeded}명`);
```

> **주의**: 서버 재시작 시 UserStore가 초기화되므로, 서버 기동 후 매번 시딩 필요

---

### Step 3: k6 테스트 스크립트

**위치**: `load-test/` 디렉토리

#### k6 Web Dashboard (결과 시각화)

k6 내장 Web Dashboard를 사용하면 CLI 외에 브라우저에서 실시간 메트릭을 확인할 수 있습니다. 별도 설치 없이 환경변수만 설정하면 됩니다.

```bash
# 실시간 대시보드 + 테스트 종료 후 HTML 리포트 생성
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=results/phase1-report.html \
k6 run realistic-scenario.js
```

- **실시간 대시보드**: 실행 중 `http://localhost:5665`에서 VU 수, 응답 시간, 에러율 등을 실시간 그래프로 확인
- **HTML 리포트**: 테스트 종료 후 `results/phase1-report.html` 파일 생성, 브라우저에서 열어 결과 분석

#### VU↔토큰 할당 규칙 (필수)

> **각 k6 VU는 반드시 고유한 토큰 1개를 고정 사용해야 합니다 (1:1 매핑).**
>
> 서버는 동일 username으로 중복 접속 시 이전 세션을 강제 종료합니다 (`player.gateway.ts:161-176`):
> ```
> existingSocket.emit('session_replaced', ...);
> existingSocket.disconnect(true);
> ```
> VU가 토큰을 랜덤/재사용하면 세션이 계속 교체되어 연결 수가 흔들리고 측정값이 왜곡됩니다.

**구현 방식**: `tokens.json`을 로드한 뒤, VU 인덱스로 토큰을 1:1 할당

```javascript
// k6 스크립트 공통 패턴
// k6는 load-test/ 디렉토리에서 실행하므로 같은 디렉토리의 tokens.json을 참조
const tokens = JSON.parse(open('tokens.json'));
const TARGET_HOST = __ENV.TARGET_HOST || 'http://localhost:8080'; // 머신 B에서 실행 시 필수
// WebSocket URL 변환: http:// → ws://, https:// → wss://
const TARGET_WS_HOST = TARGET_HOST.replace(/^http/, 'ws');

export default function () {
  if (__VU > tokens.length) {
    fail(`VU ${__VU} exceeds token count (${tokens.length}). Fix options.stages or generate more tokens.`);
  }
  const vuToken = tokens[__VU - 1]; // VU 1 → tokens[0], VU 2 → tokens[1], ...
  // vuToken.token, vuToken.username, vuToken.playerId 사용
}
```

> **주의**: k6의 `options.stages`에서 최대 VU 수가 `tokens.json`의 토큰 수를 초과하지 않도록 설정하세요. 초과 시 `fail()`로 테스트가 즉시 실패합니다.

#### Phase 1: 실제 행동 시뮬레이션 (`realistic-scenario.js`)

**목적**: 실서비스와 동일한 혼합 부하 패턴

> **변인 통제**: `POLL_INTERVAL_MS=999999999`로 반복 폴링 비활성화. **소켓 + 이동 + 채팅 + 포커스 + 펫 + REST 혼합 부하**를 측정합니다.
>
> **첫 baseline 폴링 1회는 불가피**: `github.poll-service.ts:172`에서 `setTimeout(..., 1000)`으로 하드코딩되어, 접속 1초 후 무조건 1회 폴링이 발생합니다. `POLL_INTERVAL_MS`는 2회차 이후 간격만 제어합니다. 첫 폴링은 baseline만 설정하고 DB 쓰기를 하지 않으므로(`status: 'first_poll'`, `github.poll-service.ts:396-399`) 부하 측정에 영향은 미미하지만, **Mock 서버가 반드시 실행 중이어야 합니다** (미실행 시 네트워크 에러 로그 70건 발생).

##### 트래픽 패턴 (점진적 Ramp-up/down)

실서비스는 전원이 동시에 접속하지 않습니다. k6 stages로 점진적 증가/감소를 시뮬레이션:

```javascript
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // warm-up
    { duration: '1m',  target: 50 },  // ramp to half
    { duration: '1m',  target: 70 },  // ramp to max
    { duration: '3m',  target: 70 },  // steady state (핵심 측정 구간)
    { duration: '1m',  target: 30 },  // ramp down
    { duration: '30s', target: 0 },   // cool down
  ],
};
```

총 ~7분. steady state 3분 구간에서 핵심 지표를 측정합니다.

##### 통합 VU 시나리오 (혼합 행동)

기존 3개 프로파일(활발/유휴/조회) 분리 대신, 모든 VU가 **가중치 기반 랜덤 행동**을 수행합니다.
실서비스에서 한 유저가 이동하다가 채팅하고, 포커스 시작 후 리더보드를 확인하는 혼합 패턴을 반영합니다.

**세션 길이 분산**: VU별 체류 시간을 랜덤(2~5분)으로 설정하여 실제 사용자 체류 패턴을 반영합니다.

```
VU 라이프사이클:
1. Socket.io 접속 + joining (방 배정)
2. 초기 REST 조회 (리더보드, 태스크 목록)
3. 메인 루프 (랜덤 2~5분 동안 반복):
   ┌─────────────────────────────────────────────────────┐
   │ 매 루프마다 가중치 기반 행동 선택:                     │
   │                                                      │
   │ ▸ 이동 (25%): 3초간 moving → 5초 정지                │
   │ ▸ 유휴 대기 (20%): 10~30초간 아무 행동 없음 (AFK)    │
   │ ▸ 채팅 (15%): chatting 이벤트 전송                   │
   │ ▸ 포커스 사이클 (15%): 태스크 생성 → focusing →      │
   │    30s~1m 대기 → (태스크 변경 10%) → resting → 완료  │
   │ ▸ REST 조회 (10%): 리더보드/태스크/히스토리 중 랜덤   │
   │ ▸ 펫 상호작용 (5%): 가챠/먹이/진화/장착 중 랜덤      │
   │ ▸ 태스크 수정·삭제 (5%): 기존 태스크 PATCH 또는 DEL  │
   │ ▸ 새로고침 (5%): disconnect → 2~5초 대기 → 재접속    │
   └─────────────────────────────────────────────────────┘
4. 연결 종료
```

> **행동 비율 설계 근거**: 실서비스에서 유저 시간의 대부분은 이동(25%)과 유휴(20%)가 차지합니다.
> 채팅(15%)과 포커스(15%)가 핵심 상호작용이며, REST 조회(10%)와 펫(5%)은 간헐적입니다.
> 태스크 수정/삭제(5%)와 새로고침(5%)은 저빈도이지만 서버에 고유한 부하를 발생시킵니다.

##### 행동별 상세

**이동 시뮬레이션 (25%):**

```
1. 3초간 moving 이벤트 전송 (100ms 간격, 초당 10회)
   - 방향: up/down/left/right 랜덤 전환
   - 서버: 같은 방에 moved 브로드캐스트
2. 5초간 정지
```

**유휴 대기 (20%):**

```
1. 10~30초간 아무 이벤트 없음 (ping/pong만)
   - 실서비스에서 탭을 켜놓고 다른 작업하는 패턴
```

**채팅 (15%):**

```
1. chatting 이벤트 전송 (메시지 30자 이내)
   - 서버: 같은 방에 chatted 브로드캐스트 (DB 쓰기 없음)
2. 3~10초 대기
```

**포커스 사이클 (15%, VU당 1~3회 반복):**

```
1. POST /api/tasks { description } → 태스크 생성 (Cookie 인증)
2. focusing 이벤트 { taskName, taskId }
3. 30초~1분 대기 (집중 중)
4. (10% 확률) focus_task_updating { taskName: "변경된 태스크" }
   → 서버: 같은 방에 focus_task_updated 브로드캐스트
5. resting 이벤트
6. PATCH /api/tasks/completion/:taskId → 태스크 완료
```

> 실서비스에서 유저는 하루에 여러 번 포커스 사이클을 반복합니다. 1회만 수행하면 DB write 패턴이 과소 측정됩니다.

**REST API 조회 (10%):**

실제 컨트롤러 라우트에 맞춘 호출:
- `backend/src/point/point.controller.ts:34` → `GET /api/points/ranks`
- `backend/src/task/task.controller.ts:36-44` → `GET /api/tasks/:playerId`
- `backend/src/pointhistory/point-history.controller.ts:20` → `GET /api/git-histories`
- `backend/src/point/point.controller.ts` → `GET /api/points`
- `backend/src/pointhistory/point-history.controller.ts` → `GET /api/history-ranks`

날짜는 **실행 시점 기준으로 동적 생성**합니다 (하드코딩 시 재사용 때 조회 결과가 비어 부하 패턴이 달라짐):

```javascript
// k6 스크립트 내부에서 동적 날짜 생성
const today = new Date().toISOString().slice(0, 10); // "2026-02-11"
const todayStart = `${today}T00:00:00.000Z`;
const todayEnd = `${today}T23:59:59.999Z`;
const weekStart = getMonday(today); // 직전 월요일 계산
```

```
아래 중 랜덤 선택:
1. GET /api/points/ranks?weekendStartAt={weekStart}T00:00:00.000Z
2. GET /api/tasks/{playerId}?isToday=true&startAt={todayStart}&endAt={todayEnd}
3. GET /api/git-histories?targetPlayerId={playerId}&startAt={todayStart}&endAt={todayEnd}
4. GET /api/points?targetPlayerId={playerId}&currentTime={todayStart}
5. GET /api/history-ranks?type=COMMITTED&weekendStartAt={weekStart}T00:00:00.000Z
```

> - 모든 REST 요청에 `Cookie: access_token=<JWT>` 헤더 포함 (JwtGuard 인증)
> - `isToday`, `startAt`, `endAt` 3개 파라미터 모두 필수 (누락 시 400 에러, ParseBoolPipe/ParseDatePipe)

**펫 상호작용 (5%):**

실제 컨트롤러 라우트에 맞춘 호출 (`backend/src/userpet/pet.controller.ts`, `backend/src/player/player.controller.ts`):

```
순서대로 시도 (이전 단계 실패 시 중단, 400 응답은 무시하고 다음 행동으로):
1. POST /api/pets/gacha → 펫 뽑기 (100 포인트 차감, pet.service.ts:36)
2. GET /api/pets/inventory/{playerId} → 보유 펫 확인
3. POST /api/pets/feed { userPetId } → 먹이주기 (10 포인트 차감, pet.service.ts:157)
4. POST /api/pets/evolve { userPetId } → 진화 (포인트 무관, 경험치 조건만, 실패해도 무시)
5. PATCH /api/players/me/equipped-pet { petId } → 펫 장착
6. pet_equipping { petId } → 소켓 이벤트로 다른 플레이어에게 알림
```

> **비용 정리**: gacha 100포인트, feed 10포인트, evolve 무료(경험치 조건만). 시드 유저의 `total_point=10000`이므로 gacha 최대 100회, feed 최대 1000회 가능.
> 포인트 부족 시 서버가 400 `Not enough points`를 반환합니다. k6 스크립트에서 400 응답은 에러 카운트에서 제외하고 다음 행동으로 넘어가야 합니다.
> 펫 시스템은 DB write(gacha, feed, evolve, equip) + 트랜잭션 내 WriteLock(`pet.service.ts:38`)과 소켓 브로드캐스트(pet_equipped)를 모두 발생시킵니다.

**태스크 수정·삭제 (5%):**

```
이전에 생성한 태스크가 있을 때:
- 50% 확률: PATCH /api/tasks/:taskId { description: "수정됨" }
- 50% 확률: DELETE /api/tasks/:taskId
```

**새로고침 시뮬레이션 (5%):**

```
1. socket.close() (정상 종료)
   → 서버: player_left 브로드캐스트, 폴링 정리, 방 퇴장
2. 2~5초 랜덤 대기 (페이지 새로고침 시간)
3. 같은 토큰으로 새 WebSocket 연결
4. joining 이벤트 전송
   → 서버: 방 재배정, players_synced, game_state 재전송
5. 정상 루프 재개
```

> 새로고침은 서버에 joining 전체 흐름(방 배정, 플레이어 동기화, 폴링 시작)을 재실행시키므로, 접속 폭주 시 서버 초기화 비용을 측정할 수 있습니다.

##### Socket.io 프로토콜 상세

**WS 연결 (Cookie 인증 필수):**

서버는 WS 핸드셰이크 시 쿠키에서 JWT를 추출합니다 (`ws-jwt.guard.ts:99-107`):

```javascript
// k6에서 WebSocket 연결 시 Cookie 헤더 필수
const wsUrl = `${TARGET_WS_HOST}/socket.io/?EIO=4&transport=websocket`;
const params = {
  headers: {
    Cookie: `access_token=${vuToken.token}`,
  },
};
const ws = new WebSocket(wsUrl, params);
```

> **Cookie 누락 시**: `extractToken()`이 null 반환 → `verifyClient()` false → 즉시 disconnect.
> 70 VU 전원 연결 실패로 테스트 무효화됩니다.

**Engine.IO 핸드셰이크 + Socket.io 연결:**

k6 WebSocket은 raw WebSocket이므로 Engine.IO/Socket.io 프로토콜을 수동 처리해야 합니다:

```
1. WS 연결 성공 (HTTP 101 Upgrade)
2. 수신: 0{"sid":"...","upgrades":[],"pingInterval":25000,"pingTimeout":20000}  (EIO OPEN)
3. 전송: 40                                                                     (SIO CONNECT)
4. 수신: 40{"sid":"..."}                                                        (SIO CONNECT ACK)
5. 이제부터 42[...] 이벤트 송수신 가능
```

**PING/PONG 처리 (필수):**

Engine.IO는 `pingInterval`(기본 25초)마다 PING(`2`)을 보냅니다. PONG(`3`)을 `pingTimeout`(기본 20초) 이내에 응답하지 않으면 서버가 연결을 끊습니다:

```javascript
ws.on('message', (data) => {
  if (data === '2') {
    ws.send('3');  // PING → PONG 응답
    return;
  }
  if (data.startsWith('42')) {
    // Socket.io 이벤트 처리
    const payload = JSON.parse(data.slice(2));
    const [event, eventData] = payload;
    // event: 'joined', 'players_synced', 'game_state', 'moved', 'chatted', ...
  }
});
```

> **PING/PONG 미처리 시**: 25~45초 후 서버가 `ping timeout`으로 연결 종료 → 유휴 유저(20%)가 대량 disconnect되어 측정값 왜곡.

**이벤트 전송:**

```
// joining 이벤트 전송
socket.send('42["joining",{"x":300,"y":300,"username":"loadtest-user-1"}]')

// moving 이벤트 전송
socket.send('42["moving",{"x":350,"y":300,"isMoving":true,"direction":"right","timestamp":1739280000000}]')

// chatting 이벤트 전송 (최대 30자)
socket.send('42["chatting",{"message":"화이팅!"}]')

// focusing 이벤트 전송 (taskId 포함)
socket.send('42["focusing",{"taskName":"테스트 태스크","taskId":1}]')

// focus_task_updating 이벤트 전송 (집중 중 태스크 변경)
socket.send('42["focus_task_updating",{"taskName":"변경된 태스크"}]')

// resting 이벤트 전송
socket.send('42["resting",{}]')

// pet_equipping 이벤트 전송 (펫 장착 후 소켓 알림)
socket.send('42["pet_equipping",{"petId":1}]')
```

##### 행동별 서버 부하 요약

| 행동 | 소켓 브로드캐스트 | DB Read | DB Write | 비율 |
|------|------------------|---------|----------|------|
| 이동 | moved (방 전체) | - | - | 25% |
| 유휴 | - | - | - | 20% |
| 채팅 | chatted (방 전체) | - | - | 15% |
| 포커스 | focused/rested (방 전체) | focus_time 조회 | focus_time 갱신, task 갱신 | 15% |
| REST 조회 | - | points/tasks/history | - | 10% |
| 펫 | pet_equipped (방 전체) | 펫/도감 조회 | gacha/feed/evolve/equip | 5% |
| 태스크 수정·삭제 | - | task 조회 | task 갱신/삭제 | 5% |
| 새로고침 | player_left + player_joined | 방/플레이어 조회 | - | 5% |

#### Phase 2: 폴링 스파이크 테스트 (`polling-spike.js`)

**목적**: GitHub 폴링이 동시에 몰릴 때 DB 쓰기 부하 측정

> **변인 통제**: `POLL_INTERVAL_MS=10000` + Mock `spike` 모드(`MOCK_MODE=spike`). 유저 행동(이동/REST) 없이 접속만 유지하여, **폴링 DB 쓰기 동시성만** 순수하게 측정합니다.

**서버 폴링 동작 (현재 코드 기준):**

```
유저 접속 → 1초 후 첫 폴링 (baseline 설정, 이벤트 처리 안 함)
         → POLL_INTERVAL_MS 후 2차 폴링 (새 이벤트 감지 → DB 쓰기 + 브로드캐스트)
```

첫 폴링은 `lastEventId`만 설정하고 `{ status: 'first_poll' }`을 반환하므로 DB 쓰기가 발생하지 않습니다 (`github.poll-service.ts:396-399`).

**테스트 전략**: `POLL_INTERVAL_MS=10000` (10초)으로 축소하여 대기 시간 단축

```
[T+0s]   50명 동시 접속
[T+1s]   50건 첫 폴링 (baseline만 설정, DB 쓰기 없음)
[T+11s]  50건 2차 폴링 동시 시작
         → Mock 서버가 모든 유저에게 새 이벤트 반환 (ETag 변경)
         → 50건 동시 DB 쓰기 발생 (point_history, daily_github_activity, daily_point)
         → 50건 동시 브로드캐스트 (progress_update)
[T+21s]  50건 3차 폴링 (Mock에서 304 → DB 쓰기 없음, 정상 상태 확인)
[T+31s]  Mock에서 다시 새 이벤트 반환 → 2차 스파이크
         반복 3~5회
[T+60s]  연결 종료
```

**Mock 서버 이벤트 생성 전략 (`spike` 모드, Phase 2 전용):**

```
요청 횟수 카운트 (유저별)
  1번째: 200 + 이벤트 반환 (baseline용)
  2번째: ETag 변경 + 새 이벤트 (ID 변경) → 스파이크 트리거
  3번째: 304 Not Modified (안정 확인)
  4번째: ETag 변경 + 새 이벤트 → 2차 스파이크
  ...
```

> `silent` 모드에서는 첫 요청만 200으로 baseline을 제공하고, 이후 모든 요청에 304를 반환합니다.

**측정 항목:**
- SQLite BUSY 에러 발생 횟수/비율 (서버 로그 `errors.log`에서 `SQLITE_BUSY` grep)
- progress_update 브로드캐스트 지연 (k6에서 이벤트 수신 타임스탬프로 측정)

> ~~DB 쓰기 응답시간 (p50/p95/p99)~~: 현재 코드에 DB write latency 커스텀 메트릭이 없어 직접 측정 불가. BUSY 에러 비율과 progress_update 지연으로 간접 측정합니다.

이 테스트가 SQLite 병목을 가장 빨리 드러냅니다.

---

### Step 4: 서버 모니터링

#### (a) Prometheus 메트릭 (주 모니터링)

서버가 이미 `GET /metrics`를 제공하므로 (`app.module.ts:44`, `PrometheusModule.register`) 이를 주 모니터링 소스로 활용:

```bash
# load-test/collect-metrics.sh
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
METRICS_DIR="$SCRIPT_DIR/results/metrics-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$METRICS_DIR"

while true; do
  TIMESTAMP=$(date +%s)
  curl -s http://localhost:8080/metrics > "$METRICS_DIR/${TIMESTAMP}.prom"
  sleep 1
done
```

> **경로 기준**: 스크립트 내부에서 `$(dirname "$0")`를 사용하여 스크립트 파일 위치 기준으로 경로를 결정합니다. `backend/`에서 `bash ../load-test/collect-metrics.sh`로 실행해도 결과는 항상 `load-test/results/`에 저장됩니다.

#### (b) 시스템 리소스 보조 모니터링

**위치**: `load-test/monitor.sh`

> Winston 로거는 **파일 로깅 없음, 콘솔 기본** (`backend/src/config/logger.winston.ts:18`). 프로덕션 + 환경변수 설정 시 Axiom transport 병행 가능 (`backend/src/config/logger.winston.ts:42,53`). 부하 테스트 환경에서는 콘솔만 사용하므로 에러 수집은 서버 stdout 리다이렉트에 의존합니다.

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
METRICS_DIR="$SCRIPT_DIR/results/metrics-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$METRICS_DIR"

# CPU/메모리 (1초 간격)
vmstat 1 >> "$METRICS_DIR/vmstat.log" &
VMSTAT_PID=$!

# 서버(8080) TCP ESTABLISHED 연결 수 (WS + REST + metrics 포함)
while true; do
  COUNT=$(ss -t state established sport = :8080 2>/dev/null | tail -n +2 | wc -l || echo "0")
  echo "$(date +%s) $COUNT" >> "$METRICS_DIR/connections.log"
  sleep 1
done &
CONN_PID=$!

# Node.js 프로세스 메모리 (dist/main.js 프로세스 직접 매칭)
# start:prod(node dist/main) 사용 시 watcher 프로세스 없이 앱 프로세스를 정확히 잡음
while true; do
  NEST_PID=$(pgrep -f "node dist/main" | head -1 || echo "")
  if [ -n "$NEST_PID" ]; then
    RSS=$(ps -o rss= -p "$NEST_PID" 2>/dev/null || echo "0")
    echo "$(date +%s) $RSS" >> "$METRICS_DIR/memory.log"
  fi
  sleep 1
done &
MEM_PID=$!

echo "모니터링 시작. 결과: $METRICS_DIR"
echo "PID: vmstat=$VMSTAT_PID conn=$CONN_PID mem=$MEM_PID"
echo "중지: kill $VMSTAT_PID $CONN_PID $MEM_PID"

# Ctrl+C로 전체 종료
trap "kill $VMSTAT_PID $CONN_PID $MEM_PID 2>/dev/null; exit" INT TERM
wait
```

#### (c) 에러 수집 (서버 실행 + 필터링 통합)

> 서버 실행과 에러 수집을 하나의 흐름으로 묶어 변수 스코프 문제를 방지합니다.

**위치**: `load-test/start-server.sh`

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/results/logs-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$LOG_DIR"

# 프로덕션 빌드 서버 실행 (watch 모드는 파일 감시 오버헤드로 측정값 왜곡)
# pnpm build 이후 dist/main.js를 직접 실행
node dist/main >> "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!

# 에러 필터링 (서브셸로 묶어 PID 1개로 관리)
sleep 2  # 서버 시작 대기
(tail -f "$LOG_DIR/server.log" | grep --line-buffered -E "SQLITE_BUSY|EMFILE|OOM|ECONNRESET" \
  >> "$LOG_DIR/errors.log") &
FILTER_PID=$!

echo "서버 시작 (PID: $SERVER_PID). 로그: $LOG_DIR"
echo "실시간 로그 확인: tail -f $LOG_DIR/server.log"
echo "중지: kill $SERVER_PID $FILTER_PID"

# Ctrl+C, 크래시, 또는 서버 종료 시 전체 정리
# EXIT 트랩 포함으로 set -e에 의한 즉시 종료 시에도 정리 보장
cleanup() {
  kill $SERVER_PID 2>/dev/null || true
  kill $FILTER_PID 2>/dev/null || true
  kill -- -$$ 2>/dev/null || true
}
trap cleanup INT TERM EXIT

SERVER_EXIT_CODE=0
wait $SERVER_PID || SERVER_EXIT_CODE=$?
# 서버가 먼저 종료된 경우 (크래시 등) trap EXIT가 cleanup을 보장
echo "서버 종료됨 (exit code: $SERVER_EXIT_CODE). 필터 프로세스 정리 중..."
```

> **PID 관리**:
> - `node dist/main >> file 2>&1 &`로 실행하면 `$!`가 Node.js 앱 프로세스 PID를 직접 잡습니다 (watcher 프로세스 없음).
> - 에러 필터 파이프라인은 `(tail | grep >> file) &`로 서브셸에 묶어 `$!` 하나로 관리합니다.
> - `cleanup()`이 SERVER_PID, FILTER_PID를 개별 kill 후 프로세스 그룹 kill(`kill -- -$$`)로 누락 방지합니다.
> - `wait $PID || SERVER_EXIT_CODE=$?`로 종료 코드를 별도 변수에 캡처하여 디버깅 시 크래시 원인을 파악할 수 있습니다.

---

## 실행 순서

### 사전 준비

> **머신 A**: 서버 관련 명령어는 `backend/` 디렉토리에서 실행합니다.
> **머신 B**: k6/Mock 서버는 `load-test/` 파일이 있는 디렉토리에서 실행합니다.

```bash
# 머신 A: 작업 디렉토리 이동
cd backend
```

```
1. [머신 A] load-test 브랜치 체크아웃
   git checkout -b load-test main

2. [머신 A] Step 0 서버 코드 변경
   - 0-1: UserStore 시딩 엔드포인트 추가 (auth.controller.ts, 시크릿 가드 포함)
   - 0-2: GITHUB_API_BASE_URL, POLL_INTERVAL_MS, LOAD_TEST_SECRET 환경변수 분리
          (env.validation.ts, github.poll-service.ts, github.module.ts)
   - 0-3: .gitignore에 load-test/tokens.json 추가

   Step 1~4 산출물 생성 (load-test/ 디렉토리):
   - Step 1: github-mock-server.js
   - Step 2: generate-tokens.ts, seed-test-users.sql, reset-db.sql
   - Step 3: realistic-scenario.js, polling-spike.js
   - Step 4: collect-metrics.sh, monitor.sh, start-server.sh
   모든 파일이 load-test/에 존재하는지 확인 후 다음 단계로 진행

3. [머신 A] 서버 빌드 + 스모크 테스트 (push 전 검증)
   pnpm build
   # 스모크 테스트: 변경사항이 런타임에서 정상 동작하는지 확인
   export LOAD_TEST_SECRET=your-random-secret-here
   LOAD_TEST_SECRET=$LOAD_TEST_SECRET node dist/main &
   SMOKE_PID=$!
   sleep 5
   # (a) test-seed-users 인증 확인 (시크릿 없으면 403)
   curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/auth/test-seed-users \
     -H "Content-Type: application/json" -d '{"users":[]}' | grep -q 403
   # (b) test-seed-users 시크릿 있으면 200
   curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8080/auth/test-seed-users \
     -H "Content-Type: application/json" -H "x-load-test-secret: $LOAD_TEST_SECRET" \
     -d '{"users":[]}' | grep -q 200
   # (c) GITHUB_API_BASE_URL 적용은 Phase 2에서 Mock 서버 요청 수신으로 확인
   kill "$SMOKE_PID"; wait "$SMOKE_PID" 2>/dev/null

4. [머신 A] 스모크 통과 후 커밋 + 원격 push
   git add -A && git commit -m "chore: 부하 테스트 환경 구성"
   git push -u origin load-test

5. [머신 B] k6 설치

6. [머신 A] DB 백업 후 테스트 유저 INSERT (멱등, 반복 실행 안전)
   BACKUP_FILE=data/jandi.sqlite.bak-$(date +%Y%m%d_%H%M%S)
   cp data/jandi.sqlite "$BACKUP_FILE"
   echo "백업 완료: $BACKUP_FILE"
   sqlite3 data/jandi.sqlite < ../load-test/seed-test-users.sql
   # 테스트 종료 후 원본 복원: cp "$BACKUP_FILE" data/jandi.sqlite

7. [머신 A, 터미널 1] 프로덕션 빌드 후 서버 실행 (에러 수집 포함, 포그라운드 점유)
   pnpm build
   # Phase 1/2: 폴링 사실상 비활성화 (테스트 시간 내 폴링 0회)
   GITHUB_API_BASE_URL=http://머신B_IP:9090 \
   POLL_INTERVAL_MS=999999999 \
   LOAD_TEST_SECRET=your-random-secret-here \
   LOG_LEVEL=warn \
   bash ../load-test/start-server.sh

8. [머신 A, 터미널 2] JWT 토큰 생성 + UserStore 시딩
   LOAD_TEST_SECRET=your-random-secret-here npx ts-node ../load-test/generate-tokens.ts
   (DB에서 playerId 조회 → 토큰 생성 → POST /auth/test-seed-users 호출)

9. [머신 B] 저장소 clone + load-test 브랜치 체크아웃 + 디렉토리 준비
   cd ~ && git clone <repo-url> && cd web19-estrogenquattro && git checkout load-test
   cd load-test && mkdir -p results
   이후 모든 머신 B 작업은 ~/web19-estrogenquattro/load-test/ 에서 실행

10. [머신 A → 머신 B] 토큰 파일 전송 (tokens.json은 .gitignore 대상)
    scp ../load-test/tokens.json 머신B_IP:~/web19-estrogenquattro/load-test/tokens.json
```

### 테스트 실행

```
11. [머신 B] Mock 서버 실행 (load-test/ 에서, silent 모드)
    node github-mock-server.js
    (Node.js 내장 http 모듈만 사용, npm install 불필요)
12. [머신 A] 모니터링 시작 (backend/ 에서, 별도 터미널 2개)
    bash ../load-test/collect-metrics.sh   # Prometheus 메트릭 수집 (주 모니터링)
    bash ../load-test/monitor.sh           # 시스템 리소스 보조 모니터링
13. [머신 B] k6 Phase 1 실행 (load-test/ 에서, Web Dashboard + HTML 리포트)
    TARGET_HOST=http://머신A_IP:8080 \
    K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=results/phase1-report.html \
    k6 run realistic-scenario.js
14. Phase 1→2 초기화 (폴링 활성화 + spike 모드 전환)
    14a. [머신 B] Mock 서버 재시작 (Ctrl+C → MOCK_MODE=spike node github-mock-server.js)
    14b. [머신 A] 서버 종료 (start-server.sh 터미널에서 Ctrl+C)
    14c. [머신 A] sqlite3 data/jandi.sqlite < ../load-test/reset-db.sql
    14d. [머신 A] 서버 재시작 (**POLL_INTERVAL_MS=10000으로 변경**)
         GITHUB_API_BASE_URL=http://머신B_IP:9090 \
         POLL_INTERVAL_MS=10000 \
         LOAD_TEST_SECRET=your-random-secret-here \
         LOG_LEVEL=warn \
         bash ../load-test/start-server.sh
    14e. [머신 A] UserStore 재시딩 (별도 터미널)
         LOAD_TEST_SECRET=your-random-secret-here npx ts-node ../load-test/generate-tokens.ts
15. [머신 B] k6 Phase 2 실행
    TARGET_HOST=http://머신A_IP:8080 \
    K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=results/phase2-report.html \
    k6 run polling-spike.js
16. 결과 종합 분석 → 서버 스펙 권장안 도출
```

### Phase 1→2 초기화 (DB + 서버 + Mock 재시작)

> **주의**: DB만 초기화하면 서버 메모리 상태(폴링 스케줄, 방 배정, 소켓 세션)가 오염된 채 다음 Phase로 넘어갑니다.
> 반드시 **서버 재시작**을 함께 수행하여 메모리 상태도 초기화하세요.
>
> **Mock 서버도 재시작 필수**: Mock 서버의 유저별 요청 횟수 카운터를 초기화하고, `spike` 모드로 전환해야 Phase 2의 스파이크 타이밍 가정(N번째 요청에서 새 이벤트 반환)이 정확합니다.

```bash
# [머신 B] 0. Mock 서버 재시작 (spike 모드로 전환)
MOCK_MODE=spike node github-mock-server.js

# [머신 A] 1. 서버 종료 (start-server.sh의 Ctrl+C 또는 kill)
# [머신 A] 2. DB 초기화
sqlite3 data/jandi.sqlite < ../load-test/reset-db.sql
# [머신 A] 3. 서버 재시작 (POLL_INTERVAL_MS=10000으로 변경)
GITHUB_API_BASE_URL=http://머신B_IP:9090 \
POLL_INTERVAL_MS=10000 \
LOAD_TEST_SECRET=your-random-secret-here \
LOG_LEVEL=warn \
bash ../load-test/start-server.sh
# [머신 A] 4. UserStore 재시딩 (서버 재시작 시 인메모리 Map 초기화됨)
LOAD_TEST_SECRET=your-random-secret-here npx ts-node ../load-test/generate-tokens.ts
```

SQLite는 TRUNCATE를 지원하지 않으므로 `DELETE FROM` 사용:

```sql
-- load-test/reset-db.sql
-- 폴링/포인트 관련 데이터만 초기화 (테스트 유저는 유지)
DELETE FROM point_history WHERE player_id IN (SELECT id FROM players WHERE social_id BETWEEN -70 AND -1);
DELETE FROM daily_github_activity WHERE player_id IN (SELECT id FROM players WHERE social_id BETWEEN -70 AND -1);
DELETE FROM daily_point WHERE player_id IN (SELECT id FROM players WHERE social_id BETWEEN -70 AND -1);
DELETE FROM daily_focus_time WHERE player_id IN (SELECT id FROM players WHERE social_id BETWEEN -70 AND -1);
DELETE FROM tasks WHERE player_id IN (SELECT id FROM players WHERE social_id BETWEEN -70 AND -1);

-- 플레이어 상태 리셋 (total_point을 시드값으로 복원, 포커스 컬럼 초기화)
UPDATE players SET total_point = 10000, focusing_task_id = NULL, last_focus_start_time = NULL
WHERE social_id BETWEEN -70 AND -1;

-- global_state 리셋
UPDATE global_state SET progress = 0, contributions = '{}', map_index = 0 WHERE id = 1;
```

```bash
# 실행 (backend/ 디렉토리에서)
sqlite3 data/jandi.sqlite < ../load-test/reset-db.sql
```

> **본인 접속 테스트**: Phase 1 실행 중 브라우저로 머신 A에 접속하면
> 가상 유저들이 맵에서 돌아다니는 것을 직접 확인하고 체감 렉을 느낄 수 있습니다.

---

## 기대 결과 및 성공 기준

### 정량 임계치

| 지표 | 안정 (Pass) | 경계 (Warning) | 실패 (Fail) |
|------|------------|----------------|-------------|
| WS 연결 성공률 (핸드셰이크) | >= 99% | >= 95% and < 99% | < 95% |
| Joining 성공률 (방 입장) | >= 99% | >= 95% and < 99% | < 95% |
| WS 연결 시간 p95 | < 500ms | >= 500ms and < 2s | >= 2s |
| REST API 응답 p95 | < 300ms | >= 300ms and < 1s | >= 1s |
| REST API 응답 p99 | < 1s | >= 1s and < 3s | >= 3s |
| 에러율 (HTTP 5xx + 비정상 WS disconnect) | < 1% | >= 1% and < 5% | >= 5% |
| SQLite BUSY 에러 비율 | 0% | > 0% and <= 1% | > 1% |
| 서버 RSS 메모리 증가율 | < 50MB/10min | >= 50MB and < 200MB/10min | >= 200MB/10min (leak 의심) |

> **에러율 측정 주의**: k6 시나리오의 의도적 연결 종료(ramp-down, 시나리오 완료 후 disconnect)는 에러에서 제외합니다. 비정상 disconnect만 카운트: 서버 강제 종료, 타임아웃, session_replaced 등.

### VU별 예상 상태

| VU 수 | 예상 상태 | 확인 항목 |
|-------|----------|----------|
| 30명 | 안정 | 기준 성능 측정 (baseline), 모든 지표 Pass 예상 |
| 50명 | 경계 | SQLite BUSY 첫 발생 여부, p95 추이 변화 |
| 70명 | 한계 (최대 방 입장) | 임계치 초과 지표 개수, 서버 안정성 유지 여부 |

### 스펙 권장안 도출 기준

- **모든 지표 Pass** → 해당 VU 수에서 안정 운영 가능
- **Warning 1개 이상** → 해당 VU 수가 실 운영 한계선, 모니터링 강화 필요
- **Fail 1개 이상** → 해당 VU 수 미만으로 운영 권장, 병목 지점 분석 후 최적화 필요

> **이번 사이클 목표: 70 VU (최대 방 입장 수).**
> 시드 SQL(-1~-70)과 토큰 생성 스크립트 모두 70명 기준으로 구성됩니다.
> 70명 초과 테스트가 필요하면 다음 4가지를 **함께** 변경해야 합니다:
> 1. `room.service.ts`의 방 수/용량 확장
> 2. `seed-test-users.sql`의 INSERT 범위 확장
> 3. `reset-db.sql`의 `BETWEEN` 범위를 동일하게 확장
> 4. `generate-tokens.ts`의 유저 수 상수 변경

---

## 디렉토리 구조

```
load-test/
├── github-mock-server.js      # GitHub API Mock 서버
├── generate-tokens.ts          # JWT 토큰 bulk 생성 + UserStore 시딩 (머신 A에서 실행)
├── seed-test-users.sql         # 테스트 유저 DB INSERT (INSERT OR IGNORE, 멱등)
├── reset-db.sql                # Phase 간 DB 초기화 (DELETE FROM)
├── realistic-scenario.js       # Phase 1: 실제 시나리오
├── polling-spike.js            # Phase 2: 폴링 스파이크
├── collect-metrics.sh          # Prometheus 메트릭 수집
├── monitor.sh                  # 시스템 리소스 보조 모니터링
├── start-server.sh             # 서버 실행 + 에러 수집 통합
├── tokens.json                 # 생성된 토큰 (.gitignore 필수)
└── results/                    # 테스트 결과 저장
    ├── phase1-report.html      # k6 Web Dashboard HTML 리포트
    ├── phase2-report.html
    └── metrics-*/              # Prometheus/시스템 모니터링 로그
```

---

## 리뷰 반영 사항

### Round 1

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | Critical | JWT만으로 WS 인증 통과 불가 (UserStore 미등록) | Step 0-1: `POST /auth/test-seed-users` 엔드포인트 추가, `load-test` 브랜치 전략 |
| 2 | High | Phase 3 "1초 후 DB 쓰기" 불가 (첫 폴링은 baseline만) | Phase 3 타이밍 수정 + `POLL_INTERVAL_MS` 환경변수로 축소 |
| 3 | High | REST 엔드포인트 불일치 (404 발생) | API 조회 시나리오를 실제 라우트로 수정 |
| 4 | High | seed SQL의 social_id에 문자열 사용 (bigint 컬럼) | 숫자 ID (-1~) 사용으로 변경 |
| 5 | Medium | GITHUB_API_BASE_URL 반영 불완전 | ConfigService 주입 + env.validation.ts 스키마 추가 명시 |
| 6 | Medium | 모니터링 스크립트 신뢰성 부족 | Prometheus 주 모니터링 + 스크립트 안전성 개선 |

### Round 2

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | generate-tokens.ts를 머신 B에서 실행 불가 (DB가 머신 A 로컬) | 머신 A에서 실행 후 `scp`로 `tokens.json` 전송하도록 변경 |
| 2 | High | DB 경로 `backend/database.sqlite` 불일치 | 실제 경로 `data/jandi.sqlite`로 수정 (data-source.ts:7) |
| 3 | High | SQLite에서 TRUNCATE 미지원 | `DELETE FROM` + 테스트 유저 범위 조건으로 변경, `reset-db.sql` 추가 |
| 4 | High | tasks API 파라미터 불완전 (`isToday`, `startAt`, `endAt` 필수) | 3개 파라미터 모두 포함 + 필수 주석 추가 |
| 5 | High | test-seed-users 보안 가드 부재 | `LOAD_TEST_SECRET` 헤더 검증 추가 (env 없으면 항상 403) |
| 6 | Medium | 로그 파일 경로 불일치 (파일 로깅 없음, 콘솔 only) | stdout 리다이렉트 방식으로 변경, 파일 tail 제거 |
| 7 | Medium | seed SQL 반복 실행 시 unique 위반 | `INSERT OR IGNORE` 사용으로 멱등성 확보 |
| 8 | Low | 환경변수 명칭 혼재 (POLL_INTERVAL vs POLL_INTERVAL_MS) | 모든 표기를 `POLL_INTERVAL_MS`로 통일 |

### Round 3

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | 실행 경로 충돌 (DB는 `backend/data/`, 루트에 `start:dev` 없음) | 실행 기준 디렉토리를 `backend/`로 통일, 모든 명령어 수정 |
| 2 | High | tokens.json이 .gitignore에 없음 (JWT 유출 위험) | Step 0-3 추가: `.gitignore`에 `load-test/tokens.json` 등록 |
| 3 | Medium | 에러 수집의 `$METRICS_DIR` 변수 스코프 끊김 | `start-server.sh`로 서버+에러 수집 통합, 변수 스코프 일치 |
| 4 | Medium | VU↔토큰 1:1 규칙 미명시 (중복 접속 시 세션 교체) | VU↔토큰 할당 규칙 섹션 추가, `player.gateway.ts:161` 동작 명시 |
| 5 | Medium | baseUrl이 3개 다른 메서드에 분산 (누락 위험) | 클래스 레벨 getter `githubApiBaseUrl` 패턴으로 변경 |
| 6 | Low | `pointhistory/` 디렉토리명 표기 불일치 | 소스 참조를 `backend/src/pointhistory/point-history.controller.ts`로 정확히 표기 |

### Round 4

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | `reset-db.sql`의 `social_id >= -1` 범위가 너무 넓어 의도하지 않은 데이터 삭제 가능 | `BETWEEN -70 AND -1`으로 정확한 범위 지정 |
| 2 | High | `start-server.sh`의 `pnpm \| tee &`에서 `$!`가 tee PID를 잡아 서버 프로세스 제어 불가 | 파일 직접 리다이렉트(`>> file 2>&1 &`)로 변경, PID 정확히 포착 |
| 3 | High | UserStore 시딩 fetch 호출이 응답 검증 없이 종료 (실패 시 이후 WS 전부 인증 실패) | `res.ok` 검증 + 실패 시 `process.exit(1)`로 조기 중단 |
| 4 | Medium | 스크립트 내부 경로 `load-test/results/`가 `backend/`에서 실행 시 잘못된 위치에 생성 | `$(dirname "$0")` 기반 `SCRIPT_DIR`로 스크립트 파일 위치 기준 경로 결정 |
| 5 | Medium | "모든 명령어는 backend에서" 규칙이 머신 B k6/Mock 실행과 충돌 | 머신별 실행 디렉토리 명확화 (머신 A: `backend/`, 머신 B: `~/load-test/`) |

### Round 5

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | k6 스크립트의 `open('../load-test/tokens.json')` 경로가 머신 B 실행 환경과 불일치 | `open('tokens.json')`으로 변경 (k6는 `load-test/`에서 실행) |
| 2 | High | `set -euo pipefail` + `ss -s \| grep estab` 매치 실패 시 스크립트 종료 | 포트 필터링 `ss -t state established dst :8080`로 변경 + `2>/dev/null` 안전 처리 |
| 3 | Medium | `ss -s \| grep estab`가 시스템 전체 ESTAB 합계 (8080 외 트래픽 혼입) | `ss -t state established dst :8080 \| wc -l`로 서버 포트 한정 필터링 |
| 4 | Medium | `tail \| grep \| while` 파이프라인 백그라운드 시 하위 프로세스 고아화 | 서브셸 `(tail \| grep >> file) &` + `kill -- -$$` 프로세스 그룹 종료로 변경 |

### Round 6

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | `ss -t state established dst :8080`은 클라이언트 관점 필터 (서버에서는 `sport`) | `sport = :8080`으로 변경 (서버 리스닝 포트 기준) |
| 2 | High | `wait $SERVER_PID` 후 서버 크래시 시 필터 프로세스 고아화 | `cleanup()` 함수 추가, `wait` 이후에도 정리 로직 실행 |
| 3 | Medium | `collect-metrics.sh`가 정의만 되고 실행 순서에 누락 | Step 10에 `collect-metrics.sh` + `monitor.sh` 병렬 실행으로 추가 |
| 4 | Medium | API 조회 날짜가 하드코딩 (재사용 시 빈 결과 → 부하 왜곡) | k6 스크립트 내부에서 동적 날짜 생성 패턴으로 변경 |
| 5 | Medium | 머신 B 파일 전송이 `tokens.json`만 명시 (k6/Mock 스크립트 누락) | `scp -r ../load-test` 일괄 전송으로 변경 |
| 6 | Low | "JWT 시크릿 포함" 표현 부정확 (실제는 JWT 토큰/액세스 토큰) | "JWT 토큰과 액세스 토큰이 포함"으로 정정 |

### Round 7

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | `scp -r ../load-test`가 `~/load-test/load-test` 중첩 생성 가능 | 머신 B도 repo clone + branch checkout, `tokens.json`만 scp 전송 |
| 2 | High | `start-server.sh`가 포그라운드 점유 → Step 7을 같은 터미널에서 실행 불가 | Step 6에 "터미널 1", Step 7에 "터미널 2" 명시 |
| 3 | Medium | `scp -r`이 `results/`까지 전송 (설명과 불일치) | repo clone 방식으로 전환하여 해소 |
| 4 | Medium | Step 0-1 스니펫이 import/DI 없이 컴파일 불가 | `Body, Post, Headers, ForbiddenException` import + `UserStore` constructor 주입 코드 추가 |

### Round 8

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | `start-server.sh` 크래시 시 `set -e`로 즉시 종료되어 cleanup 미실행 | trap에 `EXIT` 추가, `cleanup()` 내 kill에 `\|\| true` 추가, `wait` 실패 방어 |
| 2 | High | Phase 간 DB만 초기화하여 서버 메모리 상태(폴링 스케줄, 방 배정) 오염 | Phase 간 초기화 절차에 서버 재시작 + UserStore 재시딩 단계 추가 |
| 3 | Medium | "70명 초과 테스트" 언급과 시드/리셋 SQL 범위(70명 고정) 불일치 | 이번 사이클 목표 70 VU 명시, 확장 시 변경해야 할 4가지 항목 목록화 |
| 4 | Medium | 머신 B에서 `node github-mock-server.js` 실행 전 의존성 설치 전제 미명시 | Mock 서버가 Node.js 내장 `http` 모듈만 사용함을 명시 (npm install 불필요) |
| 5 | Medium | `tokens[__VU - 1]`이 VU > 토큰 수일 때 undefined → 인증 실패 오탐 | VU 범위 검증 가드 추가 (`__VU > tokens.length` 시 즉시 반환) |

### Round 9

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | `cleanup()`이 SERVER_PID를 직접 kill하지 않고 프로세스 그룹 kill에만 의존 → orphan 서버 가능 | `cleanup()`에 `kill $SERVER_PID` 명시 추가 (개별 kill → 그룹 kill 순) |
| 2 | High | 머신 B 작업 경로가 초반 `~/load-test`와 실행 순서 `~/web19-.../load-test/`로 충돌 | 초반 경로를 `~/web19-estrogenquattro/load-test`로 통일, Step 8에 명시적 cd 추가 |
| 3 | Medium | Step 0 검증이 `pnpm build`만으로 런타임 실패 미감지 | 스모크 테스트 추가 (시딩 인증 403/200 확인, GITHUB_API_BASE_URL 적용 확인) |
| 4 | Medium | 성공 기준이 정성 표현만 있어 스펙 권장안 도출 불가 | 정량 임계치 표 추가 (연결 성공률, p95/p99, 에러율, BUSY 비율, 메모리 증가율) |
| 5 | Low | "3가지"라고 적고 4개 항목 나열 | "4가지"로 수정 |
| 6 | Low | `wait \|\| true` 뒤 `$?`가 항상 0으로 크래시 원인 왜곡 | `SERVER_EXIT_CODE` 변수에 별도 캡처 후 출력 |

### Round 10

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | `reset-db.sql`이 `players.total_point`, 포커스 상태를 리셋하지 않아 Phase 간 오염 | `UPDATE players SET total_point = 0` 추가 (daily_focus_time은 이미 DELETE 대상) |
| 2 | High | k6 스크립트가 타깃 서버 주소 미지정 (localhost 기본값 → 머신 B 자신에 연결) | `TARGET_HOST` 환경변수 패턴 추가, 실행 커맨드에 `TARGET_HOST=http://머신A_IP:8080` 명시 |
| 3 | Medium | 스모크 테스트의 `$LOAD_TEST_SECRET`이 미정의 상태에서 curl 실행 | `export LOAD_TEST_SECRET=...`를 스모크 블록 선두에 명시 |
| 4 | Medium | `kill %1` 잡 인덱스 의존으로 다른 백그라운드 잡 간섭 가능 | `SMOKE_PID=$!` 캡처 후 `kill "$SMOKE_PID"; wait "$SMOKE_PID"` 사용 |

### Round 11

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | `reset-db.sql`이 `players.focusing_task_id`, `last_focus_start_time` 미리셋 | `UPDATE players SET ... focusing_task_id = NULL, last_focus_start_time = NULL` 추가 |
| 2 | High | 리뷰 원문에 2번 항목 없음 (입력 누락) | — |
| 3 | High | `tokens.json` 전송 경로 충돌 (Step 2: `~/load-test/` vs Step 9: `~/web19-.../load-test/`) | Step 2의 scp 경로를 `~/web19-estrogenquattro/load-test/`로 통일 |
| 4 | Medium | fresh clone 환경에서 `results/` 디렉토리 부재로 k6 HTML export 실패 | Step 8에 `mkdir -p results` 추가 |
| 5 | Medium | 스모크 테스트 (c) "로그에서 Mock URL 확인"이 재현 불가 (폴링 로그에 URL 미출력) | 검증 삭제, Phase 3 Mock 서버 요청 수신으로 대체 안내 |

### Round 12

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | 머신 A 로컬 브랜치만 생성, push 없어 머신 B에서 checkout 실패 | Step 3에 `git push -u origin load-test` 추가, 번호 체계 재정리 (1~18) |
| 2 | High | `TARGET_HOST`가 `http://`인데 Phase 1은 WebSocket 연결 → 스킴 불일치 | `TARGET_WS_HOST = TARGET_HOST.replace(/^http/, 'ws')` 변환 규칙 추가, Phase 1 URL 패턴 명시 |
| 3 | Medium | `ss sport=:8080`이 WS+REST+metrics 전체 TCP 카운트인데 지표명이 "WebSocket 연결 수" | 지표명을 "TCP ESTABLISHED 연결 수 (WS + REST + metrics 포함)"로 변경 |
| 4 | Low | 성공 기준 경계값 중복 (`>=99%` vs `95-99%` 등) | `>=`/`<` 기준 명시적 분리 (`>= 95% and < 99%` 등) |

### Round 13

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | `pnpm start:dev` (watch 모드) 파일 감시 오버헤드로 측정값 왜곡 | `pnpm build` → `node dist/main`으로 프로덕션 모드 실행, start-server.sh + 실행 순서 모두 변경 |
| 2 | Medium | push가 스모크 테스트 이전이라 깨진 코드가 원격에 올라감 | 순서 교체: 스모크 테스트(Step 3) → push(Step 4) |
| 3 | Medium | 에러율에 시나리오 의도적 disconnect가 포함되어 과대계상 | "비정상 WS disconnect"로 한정, 제외 기준 주석 추가 |
| 4 | Medium | `pgrep "node.*nest"`가 watcher 프로세스를 잡을 위험 | `pgrep "node dist/main"`으로 변경 (프로덕션 모드 전환으로 watcher 문제 해소) |
| 5 | Medium | 테스트가 기존 DB를 직접 수정하는데 백업/복원 절차 없음 | Step 6에 `cp jandi.sqlite jandi.sqlite.bak-*` 백업 + 복원 안내 추가 |

### Round 14

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | Medium | Step 0만 명시 후 바로 빌드/push → load-test/ 파일 부재 시 절차 중단 | Step 2에 Step 1~4 산출물 생성 체크리스트 추가 (파일 존재 확인 후 다음 단계) |
| 2 | Medium | 로깅 전제가 "콘솔만"으로 부정확 (프로덕션+환경변수 시 Axiom 병행) | "파일 로깅 없음, 콘솔 기본, 필요 시 Axiom 병행"으로 정정 |
| 3 | Low | Round 11 #2 누락으로 번호 불연속 | #2에 "입력 누락" 항목 추가하여 추적성 확보 |

### Round 15

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | 환경변수 안내에 기존 필수 변수(GITHUB_CLIENT_ID 등) 누락 → 서버 부팅 실패 | 필수 변수 3개 + 전제조건 주석 추가 |
| 2 | High | DB 복원 `cp *.bak-* ...`가 다중 백업 시 실패 | `BACKUP_FILE` 변수에 파일명 저장 후 동일 변수로 복원 |
| 3 | Medium | VU > 토큰 수일 때 `return`으로 조용히 빠져 부하 과소 측정 | `fail()`로 변경하여 테스트 즉시 실패 처리 |
| 4 | Low | PID 관리 설명이 `pnpm` 기준인데 스크립트는 `node dist/main` | 설명을 `node dist/main` 기준으로 통일 |

### Round 16

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | `social_id` 100000001~100000070이 실제 GitHub 유저와 충돌 가능 (GitHub ID는 2억대까지 사용 중), reset-db.sql이 실제 유저 데이터를 삭제/수정할 위험 | **음수 social_id(-1 ~ -70)** 사용으로 변경. GitHub user ID는 양의 정수이므로 충돌 불가능 |
| 2 | Medium | 환경변수 체크리스트에 `NODE_ENV=production` 시 필수인 `AXIOM_TOKEN`, `AXIOM_DATASET` 미언급 → 프로덕션 모드 실행 시 부팅 실패 | NODE_ENV를 설정하지 않도록 명시적 주의사항 추가 (부하 테스트에서는 Axiom 불필요) |
| 3 | Medium | "DB 쓰기 응답시간 p50/p95/p99" 측정 항목 선언했으나 수집 경로 없음 (커스텀 메트릭 부재) | 측정 항목에서 제거, BUSY 에러 비율 + progress_update 지연으로 간접 측정한다는 안내 추가 |
| 4 | Low | VU 초과 시 코드는 `fail()`인데 설명은 "즉시 반환" | 설명을 "`fail()`로 테스트가 즉시 실패"로 통일 |

### Round 17

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | 70명을 "최대 동시 접속"으로 전제하지만, 방이 꽉 차도 `join_failed`만 전송하고 소켓은 유지됨 (`player.gateway.ts:144-155`) → 70명 초과 WS 연결 가능, 소켓 수용 한계 측정 왜곡 | "최대 동시 접속" → "최대 방 입장"으로 용어 변경, WS 연결 성공/Joining 성공 지표 분리, Phase 1 측정 항목에 `join_failed` 수신 카운트 추가, 성공 기준에 Joining 성공률 행 추가 |
| 2 | High | Phase 간 초기화에서 Mock 서버 재시작 없음 → 유저별 요청 카운터가 누적되어 Phase 3 스파이크 타이밍 가정 붕괴 | Phase 간 초기화 절차에 Mock 서버 재시작 단계 추가 (14a), 실행 순서 14/16에 `[머신 B] Mock 재시작` 명시 |
| 3 | High | `NODE_ENV` 미설정 + `LOG_LEVEL` 미지정 → 기본 `debug` 레벨 (`backend/src/config/logger.winston.ts:13`) → 폴링 루프 debug 로그 17건+ 오버헤드로 부하 테스트 결과 과소평가 | `.env.local`에 `LOG_LEVEL=warn` 추가, 서버 실행 커맨드(Step 7, Phase 간 초기화)에도 반영, 근거 주석 추가 |
| 4 | Low | `logger.winston.ts` 파일 참조에 경로 없음 | 모든 참조를 `backend/src/config/logger.winston.ts`로 전체 경로 표기 |

### Round 18

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | Phase 1이 "순수 WS 연결 한계"를 측정 목표로 하지만, `POLL_INTERVAL_MS=10000` + Mock의 이벤트 반환으로 DB 쓰기가 섞여 변인 통제 실패 | Mock 서버에 `MOCK_MODE` 환경변수 도입 — `silent`(기본): 항상 304 반환 (DB 쓰기 0건), `spike`: N번째 폴링에서 새 이벤트 반환. Phase 1/2는 `silent`, Phase 3만 `spike` 모드. 실행 순서/Phase 간 초기화에 모드 전환 명시 |

### Round 19

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | Mock `silent` 모드(304)라도 서버가 매 10초마다 70건 HTTP 요청을 보내는 오버헤드 존재 — 순수 소켓 측정 목적에 어긋남 | Phase 1/2 서버 실행을 `POLL_INTERVAL_MS=999999999`로 변경하여 폴링 자체를 비활성화. Phase 2→3 초기화에서만 `POLL_INTERVAL_MS=10000`으로 전환. Phase 간 초기화 절차를 Phase 1→2용 / Phase 2→3용으로 분리하여 POLL_INTERVAL_MS 차이 명시 |

### Round 20

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | — | 기존 Phase 1(순수 소켓 연결 한계)은 70명 규모에서 병목이 될 확률 극히 낮아 불필요 | Phase 1 제거, 기존 Phase 2→Phase 1(실제 시나리오), Phase 3→Phase 2(폴링 스파이크)로 재번호. `socket-connection.js` 삭제, 실행 순서/초기화/디렉토리 구조/성공 기준 등 전체 Phase 참조 일괄 업데이트 |

### Round 21

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | High | Phase 1이 3개 고정 프로파일(활발 30%/유휴 50%/조회 20%)로 분리되어 실서비스의 혼합 행동 패턴 미반영 | 통합 VU 시나리오로 전환 — 가중치 기반 랜덤 행동 선택 (이동 25%, 유휴 20%, 채팅 15%, 포커스 15%, REST 10%, 펫 5%, 태스크 수정/삭제 5%, 새로고침 5%) |
| 2 | High | 채팅(`chatting`) 이벤트 미포함 — 소켓 브로드캐스트 부하 누락 | chatting 이벤트 추가 (15% 비율, 방 전체 브로드캐스트) |
| 3 | High | 포커스 사이클이 1회만 수행 — 실서비스의 반복 패턴 미반영, DB write 과소 측정 | VU당 1~3회 포커스 사이클 반복, `focus_task_updating` 이벤트(10% 확률) 포함 |
| 4 | High | 전원 동시 접속 — 비현실적 접속 패턴 | k6 stages로 점진적 ramp-up/down (20→50→70→70→30→0, 총 ~7분) |
| 5 | Medium | 펫 시스템(가챠/먹이/진화/장착) 미포함 — DB write + 소켓 브로드캐스트 누락 | 펫 상호작용 추가 (5% 비율, REST API 5개 + `pet_equipping` 소켓) |
| 6 | Medium | 태스크 수정/삭제 미포함 — 생성+완료만으로 실제 CRUD 패턴 불완전 | PATCH/DELETE /api/tasks/:taskId 추가 (5% 비율) |
| 7 | Medium | 새로고침/재접속 패턴 미포함 — joining 재처리 비용 미측정 | disconnect → 재접속 → joining 흐름 추가 (5% 비율) |
| 8 | Medium | 세션 길이 고정 (유휴 2분, 활발 ~2분) — 실서비스의 체류 시간 분산 미반영 | VU별 랜덤 세션 길이 (2~5분) |
| 9 | Low | REST 조회 대상이 3개만 (ranks, tasks, git-histories) | /api/points, /api/history-ranks 추가하여 실제 사용 패턴 반영 |
| 10 | Low | 행동별 서버 부하 유형(브로드캐스트/DB read/DB write) 미정리 | 행동별 서버 부하 요약 표 추가 |

### Round 22

| # | 심각도 | 원본 문제 | 수정 내용 |
|---|--------|----------|----------|
| 1 | Critical | 시드 유저 `total_point=0`인데 gacha 비용 100(`pet.service.ts:36`), feed 비용 10(`pet.service.ts:157`) → 펫 상호작용 전부 400 실패, DB write 0건 | 시드 SQL의 `total_point`을 0→10000으로 변경, `reset-db.sql`도 10000으로 복원, 문서의 "비용 0" 표기를 실제 비용으로 수정 |
| 2 | High | `POLL_INTERVAL_MS=999999999`로 "폴링 0회" 가정하지만, 첫 폴링은 `setTimeout(..., 1000)` 하드코딩(`github.poll-service.ts:172`)으로 1회/유저 무조건 발생 | "첫 baseline 폴링 1회 불가피" 명시, Mock 서버 Phase 1에서도 필수 실행으로 변경, `status: 'first_poll'`은 DB 쓰기 없음을 근거와 함께 설명 |
| 3 | High | k6 WS 연결 시 `Cookie: access_token=...` 헤더 미명시 — 서버는 쿠키에서만 JWT 추출(`ws-jwt.guard.ts:99-107`) → 70 VU 전원 연결 실패 | WS 연결 코드에 Cookie 헤더 포함 패턴 추가, `extractToken()` 동작 설명 |
| 4 | High | Engine.IO OPEN→CONNECT→ACK 핸드셰이크 + PING/PONG 미명시 → 유휴 유저 25~45초 후 `ping timeout` disconnect | Engine.IO 핸드셰이크 시퀀스(0→40→40{sid}) + PING(`2`)→PONG(`3`) 처리 코드 추가 |
| 5 | Medium | Mock silent 모드가 "항상 304"라고 서술하면서, 표에서는 "첫 요청 200" → 구현자 혼란 | 서술을 "첫 요청만 200 (baseline용), 이후 304"로 수정하여 표와 일치시킴 |
| 6 | Medium | 펫 400 응답(포인트 부족)이 k6 에러율에 포함되면 성공 기준 왜곡 | "400 응답은 에러 카운트에서 제외" 가이드 추가 |
