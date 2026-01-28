# GitHub 폴링 시스템

## 개요

GitHub REST Events API를 사용하여 사용자의 커밋/PR/이슈/리뷰 활동을 120초 간격으로 폴링하고, 변경 감지 시 게임에 반영

> **Note:** 이전에는 GraphQL API를 사용했으나, 이벤트별 상세 정보(레포지토리명, PR/이슈 제목)를 얻기 위해 REST Events API로 전환

---

## 폴링 흐름

```
사용자 접속 (joining)
       ↓
1초 후 첫 폴링 (기준점 설정)
       ↓
120초 간격 폴링 시작
       ↓
REST Events API 호출 (ETag 조건부 요청)
       ↓
기준점 대비 변경 감지
       ↓
변경 있음 → DB 저장 + 포인트 적립 + github_event 브로드캐스트
       ↓
프로그레스바/기여도 업데이트
```

---

## 폴링 간격

```typescript
// backend/src/github/github.poll-service.ts
const POLL_INTERVAL = 120_000;        // 120초 (기본, REST API 이벤트 갱신 지연 고려)
const POLL_INTERVAL_BACKOFF = 600_000; // 10분 (rate limit 시)
```

| 상태 | 다음 폴링 간격 |
|------|---------------|
| 새 이벤트 감지 | 120초 |
| 변경 없음 (304 Not Modified) | 120초 |
| Rate Limit (403/429) | 10분 |
| 토큰 만료 (401) | 폴링 중지 |
| 에러 | 120초 |

---

## REST Events API

### 엔드포인트

```
GET https://api.github.com/users/{username}/events/public?per_page=100
```

### 요청 헤더

```typescript
const headers = {
  Authorization: `Bearer ${accessToken}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'If-None-Match': etag,  // ETag 조건부 요청
};
```

### ETag 캐싱

- 첫 요청 시 응답 헤더에서 `ETag` 저장
- 이후 요청 시 `If-None-Match` 헤더로 전송
- 304 Not Modified 응답 시 Rate Limit 소모 안 함

---

## 이벤트 타입

| 이벤트 | 처리 | 포인트 |
|--------|------|--------|
| `PushEvent` | Compare API로 커밋 개수/메시지 조회 | +2/커밋 |
| `PullRequestEvent` (opened) | PR API로 제목 조회 | +2 |
| `PullRequestEvent` (merged/closed+merged) | PR API로 제목 조회 | +4 |
| `IssuesEvent` (opened) | 이슈 제목 직접 사용 | +1 |
| `PullRequestReviewEvent` (created) | PR API로 제목 조회 | +4 |

---

## 기준점 (Baseline) 시스템

### 목적

- 첫 폴링 시 최신 이벤트 ID를 기준점으로 저장
- 이후 폴링에서 기준점 이후의 **새 이벤트만** 처리
- 새로고침해도 기준점 유지 (세션 단위)

### 동작 방식

```typescript
interface PollingSchedule {
  timeout: NodeJS.Timeout;
  username: string;
  accessToken: string;
  roomId: string;
  clientIds: Set<string>;
  playerId: number;
  etag: string | null;        // ETag 저장
  lastEventId: string | null; // 마지막 이벤트 ID
}
```

1. **첫 폴링**: `lastEventId` 설정, 이벤트 전송 없음
2. **이후 폴링**: `lastEventId` 이후의 새 이벤트만 처리
3. **새로고침**: 기존 기준점 유지 (중복 알림 방지)

---

## 중복 폴링 방지

같은 사용자가 여러 탭/브라우저로 접속 시:

```typescript
interface PollingSchedule {
  clientIds: Set<string>; // 같은 유저의 여러 클라이언트 추적
}
```

- username 기준으로 폴링 스케줄 관리
- 새 클라이언트 접속 시 `clientIds`에 추가만 (폴링 중복 시작 X)
- 모든 클라이언트 종료 시에만 폴링 중지

---

## 추가 API 호출

### Compare API (커밋 상세)

PushEvent 발생 시 실제 커밋 개수와 메시지를 조회:

```
GET https://api.github.com/repos/{owner}/{repo}/compare/{before}...{head}
```

응답에서 추출:
- `total_commits`: 실제 커밋 개수
- `commits[].commit.message`: 커밋 메시지 (첫 줄만 사용)

### PR API (PR 제목)

PullRequestEvent, PullRequestReviewEvent 발생 시 PR 제목 조회:

```
GET https://api.github.com/repos/{owner}/{repo}/pulls/{number}
```

---

## 프로그레스 계산

```typescript
// backend/src/github/github.gateway.ts
const PROGRESS_PER_COMMIT = 2;
const PROGRESS_PER_PR = 5;

// 프로그레스 증가량
const progressIncrement =
  event.pushCount * PROGRESS_PER_COMMIT +
  event.pullRequestCount * PROGRESS_PER_PR;

// 100% 도달 시 리셋
state.progress = (state.progress + progressIncrement) % 100;
```

| 기여 유형 | 프로그레스 증가량 |
|----------|------------------|
| 커밋 1개 | +2% |
| PR 1개 | +5% |

---

## 이벤트 데이터

### github_event (S→C)

```typescript
interface GithubEventData {
  username: string;
  pushCount: number;       // 새 커밋 수
  pullRequestCount: number; // 새 PR 수
}
```

### github_state (S→C, 입장 시)

```typescript
interface RoomGithubState {
  progress: number;                      // 0-99
  contributions: Record<string, number>; // username -> 총 기여 수
}
```

---

## Rate Limit 처리

GitHub REST API Rate Limit: **5,000 requests/hour** (인증된 요청)

```typescript
// 403/429 응답 처리
if (res.status === 403 || res.status === 429) {
  this.logger.warn(`[${username}] Rate limit, waiting 10 minutes`);
  return { status: 'rate_limited' };
}
```

### ETag로 Rate Limit 절약

- 304 Not Modified 응답은 Rate Limit을 소모하지 않음
- 120초 간격 + ETag 사용으로 효율적인 폴링

---

## 네트워크 에러 처리

```typescript
let res: Response;
try {
  res = await fetch(url, { headers });
} catch (error) {
  this.logger.error(
    `[${username}] GitHub API network error: ${error.message}`,
  );
  return { status: 'error' };
}
```

### 에러 발생 시 흐름

```
fetch() 에러 발생 → catch 블록 → 로그 출력 → { status: 'error' } 반환
    → handlePoll() switch문 → nextInterval = 120초 → 120초 후 재시도
```

### 처리되는 에러 유형

| 에러 | 원인 |
|------|------|
| `getaddrinfo ENOTFOUND` | DNS 조회 실패 |
| `connect ETIMEDOUT` | 연결 타임아웃 |
| `connect ECONNREFUSED` | 연결 거부 |
| `fetch failed` | 일반 네트워크 에러 |

---

## 포인트 적립

이벤트 감지 시 자동으로 포인트가 적립됩니다:

| 이벤트 | 포인트 | DB 저장 |
|--------|--------|---------|
| 커밋 | +2/개 | daily_github_activity + point_history |
| PR 생성 | +2 | daily_github_activity + point_history |
| PR 머지 | +4 | daily_github_activity + point_history |
| 이슈 생성 | +1 | daily_github_activity + point_history |
| PR 리뷰 | +4 | daily_github_activity + point_history |

### point_history 상세 정보

```typescript
// addPoint(playerId, type, count, repository, description)
// count는 이벤트 개수이며, 실제 포인트는 ACTIVITY_POINT_MAP[type] * count로 계산

// 커밋 1개 → +2 포인트
await this.pointService.addPoint(
  playerId,
  PointType.COMMITTED,
  1,                    // 커밋 개수
  commit.repository,    // "owner/repo"
  commit.message,       // 커밋 메시지 첫 줄
);

// PR 생성 1개 → +2 포인트
await this.pointService.addPoint(
  playerId,
  PointType.PR_OPEN,
  1,                    // PR 개수
  pr.repository,        // "owner/repo"
  pr.title,             // PR 제목
);
```

---

## 로깅

```
[username] HTTP 200, remaining: 4999
[username] First poll - baseline set
[username] No changes (304)
[username] New events (3):
[username] RAW EVENT: {...}
[username] COMMIT: "feat: 새 기능" (owner/repo)
[username] PR OPENED: "새 기능 구현" #123 (owner/repo)
[username] Commits: +2, PRs: +1, Merged: +0, Issues: +0, Reviews: +0
```

---

## 타입 가드

REST API 응답의 타입 안전성을 위해 타입 가드 함수 사용:

```typescript
// 이벤트 배열 검증
export function isGithubEventArray(data: unknown): data is GithubEvent[] {
  return Array.isArray(data) && data.every(
    (item) => typeof item === 'object' && item !== null && 'id' in item && 'type' in item,
  );
}

// Compare API 응답 검증
export function isCompareResponse(data: unknown): data is CompareResponse {
  return typeof data === 'object' && data !== null &&
    'total_commits' in data && 'commits' in data;
}

// PR API 응답 검증
export function isPrResponse(data: unknown): data is PrResponse {
  return typeof data === 'object' && data !== null &&
    'number' in data && 'title' in data;
}
```

---

## 관련 문서

- [POINT_SYSTEM.md](../features/POINT_SYSTEM.md) - 포인트 시스템
- [SOCKET_EVENTS.md](./SOCKET_EVENTS.md) - github_event 소켓 이벤트
- [ERD.md](../guides/ERD.md) - daily_github_activity, point_history 테이블
