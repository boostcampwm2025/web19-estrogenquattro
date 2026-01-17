# GitHub 폴링 시스템

## 개요

GitHub GraphQL API를 사용하여 사용자의 커밋/PR 기여를 30초 간격으로 폴링하고, 변경 감지 시 게임에 반영

> **Note:** 이전에는 REST API를 사용했으나, CDN 캐시로 인해 최신 데이터를 받지 못하는 문제로 GraphQL API로 전환

---

## 폴링 흐름

```
사용자 접속 (joining)
       ↓
1초 후 첫 폴링 (기준점 설정)
       ↓
30초 간격 폴링 시작
       ↓
GraphQL API 호출
       ↓
기준점 대비 변경 감지
       ↓
변경 있음 → github_event 브로드캐스트
       ↓
프로그레스바/기여도 업데이트
```

---

## 폴링 간격

```typescript
// backend/src/github/github.poll-service.ts
const POLL_INTERVAL = 30_000;         // 30초 (기본)
const POLL_INTERVAL_BACKOFF = 120_000; // 120초 (rate limit 시)
```

| 상태 | 다음 폴링 간격 |
|------|---------------|
| 새 이벤트 감지 | 30초 |
| 변경 없음 | 30초 |
| Rate Limit (429) | 120초 또는 `X-RateLimit-Reset` 헤더 값 |
| 에러 | 30초 |

---

## GraphQL 쿼리

```graphql
query($username: String!) {
  user(login: $username) {
    contributionsCollection {
      commitContributionsByRepository(maxRepositories: 10) {
        repository {
          name
          owner { login }
        }
        contributions(last: 10) {
          nodes {
            occurredAt
            commitCount
          }
        }
      }
      pullRequestContributions(last: 10) {
        nodes {
          occurredAt
        }
      }
    }
  }
}
```

### 응답 데이터

- `commitContributionsByRepository`: 리포지토리별 커밋 기여 (최대 10개 리포)
- `pullRequestContributions`: PR 기여 (최근 10개)

---

## 기준점 (Baseline) 시스템

### 목적

- 첫 폴링 시 현재 기여 수를 기준점으로 저장
- 이후 폴링에서 기준점 대비 **증가분**만 이벤트로 전송
- 새로고침해도 기준점 유지 (세션 단위)

### 동작 방식

```typescript
interface UserBaseline {
  lastCommitCounts: Map<string, number>; // repo -> commitCount
  lastPRCount: number;
}
```

1. **첫 폴링**: 기준점 설정, 이벤트 전송 없음
2. **이후 폴링**: `현재값 - 기준점 = 새 기여 수`
3. **새로고침**: 기존 기준점 유지 (중복 알림 방지)

---

## 중복 폴링 방지

같은 사용자가 여러 탭/브라우저로 접속 시:

```typescript
interface PollingSchedule {
  timeout: NodeJS.Timeout;
  username: string;
  accessToken: string;
  roomId: string;
  clientIds: Set<string>; // 같은 유저의 여러 클라이언트 추적
}
```

- username 기준으로 폴링 스케줄 관리
- 새 클라이언트 접속 시 `clientIds`에 추가만 (폴링 중복 시작 X)
- 모든 클라이언트 종료 시에만 폴링 중지

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

GitHub GraphQL API Rate Limit: **5,000 points/hour**

```typescript
// 429 응답 처리
if (res.status === 429) {
  const resetHeader = res.headers.get('X-RateLimit-Reset');
  let retryAfter = POLL_INTERVAL_BACKOFF; // 기본 120초

  if (resetHeader) {
    const resetTime = parseInt(resetHeader, 10) * 1000;
    retryAfter = Math.max(resetTime - Date.now(), POLL_INTERVAL_BACKOFF);
  }

  return { status: 'rate_limited', retryAfter };
}
```

---

## 로깅

```
[GitHub Poll] username - HTTP 200, remaining: 4999
[username] GraphQL Response: 5 repos, total commits: 42, PRs: 3, isFirstPoll: true
[username] Top repos:
  - owner/repo1: 20 commits (+0)
  - owner/repo2: 15 commits (+0)
  - owner/repo3: 7 commits (+0)
[username] First poll - baseline set, no notification
```

변경 감지 시:
```
[username] New contributions detected! Commits: +2, PRs: +1
```
