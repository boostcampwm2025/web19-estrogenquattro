# GitHub API 전략 - Polling 방식

## 방식 비교 및 선택 이유

| 요구사항 | Polling | Webhooks | GitHub App |
|----------|---------|----------|------------|
| 모든 레포 감지 | ✅ | ❌ | ✅ |
| 기존 OAuth 활용 | ✅ | ✅ | ❌ |
| 구현 난이도 | 쉬움 | 중간 | 어려움 |

→ **모든 레포 감지 + 기존 OAuth 활용 + 빠른 구현** = Polling 선택

---

## 동작 방식

```
[백엔드 서버] --주기적 API 호출--> [GitHub API] --응답--> [백엔드 서버] --WebSocket--> [클라이언트]
```

---

## 사용 API

```
GET /users/{username}/events
```

**응답 예시 (PushEvent)**

```json
{
  "id": "12345678",
  "type": "PushEvent",
  "created_at": "2025-12-17T10:30:00Z",
  "repo": { "name": "user/repo" },
  "payload": {
    "commits": [
      { "sha": "abc123", "message": "feat: 새 기능 추가" }
    ]
  }
}
```

---

## 필요한 OAuth Scope

| Scope | 감지 범위 |
|-------|----------|
| (없음) | public 레포 활동만 |
| `repo` | public + private 레포 활동 |

---

## Rate Limit

| 항목 | 값 |
|------|-----|
| 인증된 요청 한도 | 5,000 req/hour |
| 분당 가능 횟수 | ~83 req/min |

**Polling 주기별 소모량 (사용자 1명 기준)**

| 주기 | 시간당 요청 | 여유분 |
|------|------------|--------|
| 60초 | 60 req | 4,940 |
| 30초 | 120 req | 4,880 |
| 10초 | 360 req | 4,640 |

→ 각 사용자 본인 토큰 사용 시 사용자 수 무관하게 확장 가능

---

## 최적화: Conditional Request (ETag)

GitHub API는 `ETag` 헤더를 지원합니다. 이전 응답의 ETag를 다음 요청에 포함하면:

- **변경 있음**: 200 OK + 새 데이터 (rate limit 차감)
- **변경 없음**: 304 Not Modified (rate limit 미차감)

**구현 예시**

```typescript
class GitHubPoller {
  private etagMap = new Map<string, string>(); // userId -> etag

  async pollUserEvents(userId: string, token: string) {
    const lastETag = this.etagMap.get(userId);

    const response = await fetch(
      `https://api.github.com/users/${userId}/events`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'If-None-Match': lastETag ?? '',
        },
      },
    );

    // 변경 없음 - rate limit 미차감
    if (response.status === 304) {
      return null;
    }

    // 새 이벤트 있음
    const events = await response.json();
    const newETag = response.headers.get('ETag');

    if (newETag) {
      this.etagMap.set(userId, newETag);
    }

    return events;
  }
}
```

**효과**

```
일반 Polling (30초 간격, 1시간) → 120 req 소모
ETag Polling (30초 간격, 1시간, 실제 변경 5회) → 5 req 소모 (96% 절약)
```

---

## 감지 가능한 주요 이벤트 타입

| 이벤트 | 설명 |
|--------|------|
| `PushEvent` | 커밋 푸시 |
| `PullRequestEvent` | PR 생성/수정/머지 |
| `IssuesEvent` | 이슈 생성/수정 |
| `IssueCommentEvent` | 이슈/PR 코멘트 |
| `CreateEvent` | 브랜치/태그 생성 |

---

## 권장 설정

| 항목 | 권장값 |
|------|--------|
| Polling 주기 | 10~30초 |
| ETag 캐싱 | 필수 |

---

## 아키텍처

```
┌─────────────┐     OAuth Token      ┌─────────────┐
│   Client    │ ◄──────────────────► │   Backend   │
│  (Browser)  │     WebSocket        │  (NestJS)   │
└─────────────┘                      └──────┬──────┘
                                            │
                                            │ Polling (10~30초)
                                            │ + ETag
                                            ▼
                                     ┌─────────────┐
                                     │ GitHub API  │
                                     │  /events    │
                                     └─────────────┘
```

1. 사용자 OAuth 로그인 → 토큰 저장
2. 백엔드에서 주기적으로 `/users/{username}/events` 호출
3. 새 이벤트 감지 시 WebSocket으로 클라이언트에 전송
4. ETag로 불필요한 rate limit 소모 방지

---

## 참고: 다른 방식과의 비교

### Webhooks

- 레포지토리마다 개별 웹훅 등록 필요
- 사용자가 레포 admin 권한 필요
- 모든 레포 감지 불가능

### GitHub App

- GitHub에서 별도 App 생성 필요
- 사용자에게 App 설치 단계 추가
- 구현 복잡도 높음
- 장기적으로는 더 좋은 선택지
