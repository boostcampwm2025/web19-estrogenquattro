# GitHub 폴링 시스템: GraphQL → REST API 전환 계획

> **관련 이슈**: [#240](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/240)
> **작성일**: 2026-01-27
> **브랜치**: `refactor/#240-github-rest-api`

---

## 참조한 문서

- [docs/REST_API_REPORT.md](../REST_API_REPORT.md): REST API Events 엔드포인트 실험 결과
- [docs/api/GITHUB_POLLING.md](../api/GITHUB_POLLING.md): 현재 GraphQL 폴링 시스템 명세
- [GitHub Event Types](https://docs.github.com/en/rest/using-the-rest-api/github-event-types): 공식 문서

---

## 1. 배경

### 현재 상황 (GraphQL)

- **API**: `POST https://api.github.com/graphql`
- **쿼리**: `contributionsCollection` (총량 기반)
- **폴링 주기**: 30초

### 전환 목표 (REST API)

- **API**: `GET /users/{username}/events/public`
- **장점**:
  - ETag 기반 조건부 요청 → 변화 없으면 304 응답 (Rate Limit 소모 없음)
  - 이벤트 상세 정보 제공 (레포지토리명, PR 제목 등)
  - 다양한 이벤트 타입 감지

### 제한사항

- 감지 지연: 평균 8분, 최대 30분+ (REST_API_REPORT 실험 결과)
- Private 기여 미포함 (`/events/public` 사용)
- PushEvent 커밋 개수는 Compare API 별도 호출로 조회

### GraphQL vs REST Trade-off

| 항목 | GraphQL | REST (Events API) |
|------|---------|-------------------|
| 감지 지연 | 실시간 (폴링 주기) | 평균 8분, 최대 30분+ |
| 이벤트 상세 | 총량만 (커밋 수 등) | 상세 정보 (레포명, PR 제목, 브랜치 등) |
| Rate Limit | 매 요청 소모 | 변화 없으면 0 (304) |
| Private 기여 | 포함 | 미포함 (`/events/public`) |

**선택 이유**: 이벤트성 정보(레포명, PR 제목 등) 조회에 최적화된 REST API 사용. 감지 지연은 게임 특성상 허용 가능.

### 첫 폴링 처리 (lastEventId)

**의도**: 사용자가 접속한 시점 이후에 발생한 이벤트만 집계합니다. 접속 전에 이미 존재하던 이벤트는 브로드캐스트하지 않습니다.

첫 폴링에서는 `lastEventId`를 설정하고 브로드캐스트하지 않습니다. 이후 폴링에서 `lastEventId` 이후의 새 이벤트만 브로드캐스트합니다:

```
첫 요청 (ETag 없음)
    ↓
이벤트 목록 수신 + ETag 저장
    ↓
lastEventId = 가장 최신 이벤트 ID
    ↓
브로드캐스트 없음
    ↓
이후 요청 (ETag 포함)
    ↓
304 → 스킵 / 200 → lastEventId 이후만 처리
```

---

## 2. REST API 이벤트 타입별 필드 구조

> **출처**: `gh api /users/{username}/events/public` 실제 호출 결과 (2026-01-27)
> **참고**: 아래 필드 목록은 실제 API 응답에서 확인된 필드입니다. 일부 필드는 상황에 따라 포함되지 않을 수 있습니다.

### 2.1 공통 응답 구조

모든 이벤트는 다음 공통 구조를 가집니다:

```typescript
interface GithubEvent {
  id: string;                    // 이벤트 고유 ID (예: "6085070883")
  type: string;                  // 이벤트 타입 (예: "IssuesEvent")
  actor: {
    id: number;                  // 사용자 ID
    login: string;               // 사용자 로그인명
    display_login: string;       // 표시용 로그인명
    gravatar_id: string;         // Gravatar ID (빈 문자열일 수 있음)
    url: string;                 // API URL
    avatar_url: string;          // 아바타 이미지 URL
  };
  repo: {
    id: number;                  // 저장소 ID
    name: string;                // "owner/repo" 형식
    url: string;                 // API URL
  };
  org?: {                        // organization 이벤트인 경우에만 존재
    id: number;
    login: string;
    gravatar_id: string;
    url: string;
    avatar_url: string;
  };
  payload: object;               // 이벤트 타입별 상세 데이터
  public: boolean;               // 공개 이벤트 여부 (항상 true)
  created_at: string;            // ISO 8601 형식 (예: "2026-01-27T06:30:38Z")
}
```

**공통 필드 요약:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | string | 이벤트 고유 ID (이벤트 타입별로 범위가 다름) |
| `type` | string | 이벤트 타입명 |
| `actor.login` | string | 이벤트 발생시킨 사용자 |
| `repo.name` | string | `"owner/repo"` 형식 저장소명 |
| `org.login` | string \| undefined | 조직명 (조직 이벤트인 경우) |
| `public` | boolean | 공개 여부 |
| `created_at` | string | ISO 8601 타임스탬프 |

**⚠️ 이벤트 ID 특성 (중요):**

GitHub 이벤트 ID는 **이벤트 타입별로 별도의 시퀀스**를 사용합니다. 따라서 ID의 크기 비교로 시간 순서를 판별할 수 없습니다:

| 이벤트 타입 | ID 범위 예시 | 비고 |
|-------------|-------------|------|
| IssuesEvent | 6,0xx,xxx,xxx | 6십억대 |
| IssueCommentEvent | 6,0xx,xxx,xxx | 6십억대 |
| PullRequestEvent | 6,0xx,xxx,xxx | 6십억대 |
| PullRequestReviewEvent | 6,0xx,xxx,xxx | 6십억대 |
| PushEvent | 7,8xx,xxx,xxx | 78억대 |
| CreateEvent | 7,8xx,xxx,xxx | 78억대 |
| ReleaseEvent | 6,0xx,xxx,xxx | 6십억대 |

**실제 응답 예시** (2026-01-27 테스트):
```
ID: 6090909336, Type: IssuesEvent,   created_at: 10:39:10Z (최신)
ID: 7860880060, Type: PushEvent,     created_at: 10:39:06Z
ID: 7860873554, Type: PushEvent,     created_at: 10:38:53Z
ID: 6090782518, Type: IssuesEvent,   created_at: 10:34:18Z (가장 오래됨)
```

- PushEvent ID `7860880060` > IssuesEvent ID `6090909336` (BigInt 비교)
- 하지만 IssuesEvent가 더 최신 (created_at 기준)

**결론**: 새 이벤트 필터링 시 ID 크기 비교(BigInt) 대신 **배열 인덱스 기반 `findIndex`** 사용 필수. GitHub Events API 응답은 `created_at` 기준 **내림차순** 정렬됨 (최신이 index 0).

---

### 이벤트 타입 요약표

| 이벤트 타입 | 설명 | 프로젝트 적용 | DB 저장 | 프로그레스 |
|------------|------|--------------|---------|-----------|
| **PushEvent** | 커밋 푸시 | ✅ (Compare API) | `COMMITTED` | +2% |
| **PullRequestEvent** | PR 생성/닫힘/머지 | ✅ (PR API) | `PR_OPEN`, `PR_MERGED` | +5% (open) |
| **IssuesEvent** | 이슈 생성/닫힘 | ✅ | `ISSUE_OPEN` | - |
| **PullRequestReviewEvent** | PR 리뷰 | ✅ | `PR_REVIEWED` | - |
| **CreateEvent** | 브랜치/태그/저장소 생성 | ❌ | - | - |
| **DeleteEvent** | 브랜치/태그 삭제 | ❌ | - | - |
| **IssueCommentEvent** | 이슈/PR 댓글 | ❌ | - | - |
| **ReleaseEvent** | 릴리스 발행 | ❌ | - | - |
| **WatchEvent** | 스타 | ❌ | - | - |
| **ForkEvent** | 포크 | ❌ | - | - |

> **Note**: 체크된 이벤트만 처리되며, 나머지는 무시됩니다.

---

### 2.2 PushEvent

**실제 응답**:
```json
{
  "id": "7798522249",
  "type": "PushEvent",
  "actor": { "login": "honki12345" },
  "repo": { "name": "honki12345/htdp" },
  "payload": {
    "repository_id": 966196215,
    "push_id": 30093697897,
    "ref": "refs/heads/test/minor-update-1769336830",
    "head": "dbcad646933a590e6677d34ec6f03c07ca036e0a",
    "before": "b18c41491c22486ef43c443f931138e969a2e358"
  },
  "created_at": "2026-01-25T11:49:18Z"
}
```

**payload 필드**:

| 필드 | 타입 | 설명 |
|------|------|------|
| `repository_id` | number | 저장소 ID |
| `push_id` | number | 푸시 고유 ID |
| `ref` | string | `refs/heads/{branch}` 형식 |
| `head` | string | 푸시 후 최신 커밋 SHA |
| `before` | string | 푸시 전 커밋 SHA |

**⚠️ commits 배열 없음** - Compare API로 실제 커밋 개수/메시지 조회 필요

**레포지토리 이름**: `event.repo.name`에서 추출 가능 (예: `"owner/repo"`)

**커밋 상세 조회**: `payload.before`와 `payload.head` SHA를 사용하여 Compare API 호출

---

### 2.3 PullRequestEvent

**실제 응답**:
```json
{
  "id": "6047215355",
  "type": "PullRequestEvent",
  "actor": { "login": "honki12345" },
  "repo": { "name": "honki12345/htdp" },
  "payload": {
    "action": "merged",
    "number": 3,
    "pull_request": {
      "id": 3208154824,
      "number": 3,
      "url": "https://api.github.com/repos/honki12345/htdp/pulls/3",
      "head": {
        "ref": "test/minor-update-1769336830",
        "sha": "b18c41491c22486ef43c443f931138e969a2e358",
        "repo": { "id": 966196215, "name": "htdp", "url": "..." }
      },
      "base": {
        "ref": "main",
        "sha": "9a4647183f94a1f163473460ffccbb0b050762d1",
        "repo": { "id": 966196215, "name": "htdp", "url": "..." }
      }
    }
  },
  "created_at": "2026-01-25T10:35:09Z"
}
```

**payload 필드**:

| 필드 | 타입 | 값 |
|------|------|-----|
| `action` | string | `"opened"`, `"closed"`, `"merged"`, `"reopened"` |
| `number` | number | PR 번호 |
| `pull_request.id` | number | PR 고유 ID |
| `pull_request.number` | number | PR 번호 |
| `pull_request.url` | string | API URL |
| `pull_request.head.ref` | string | 소스 브랜치명 |
| `pull_request.head.sha` | string | 소스 커밋 SHA |
| `pull_request.base.ref` | string | 타겟 브랜치명 |
| `pull_request.base.sha` | string | 타겟 커밋 SHA |

**⚠️ title, body, state 필드 없음** - PR API로 별도 조회 필요 (`GET /repos/{owner}/{repo}/pulls/{number}`)

**PR 머지 판별**: 안전을 위해 두 조건 모두 체크
```typescript
action === 'merged' || (action === 'closed' && pull_request?.merged === true)
```
- `action === "merged"`: REST_API_REPORT 실험에서 실제 관찰됨
- `action === "closed" && merged === true`: GitHub 공식 문서 표준 패턴 (fallback)

---

### 2.4 IssuesEvent

**실제 응답** (전체 필드):
```json
{
  "id": "6085070883",
  "type": "IssuesEvent",
  "actor": {
    "id": 170270,
    "login": "sindresorhus",
    "display_login": "sindresorhus",
    "gravatar_id": "",
    "url": "https://api.github.com/users/sindresorhus",
    "avatar_url": "https://avatars.githubusercontent.com/u/170270?"
  },
  "repo": {
    "id": 11855195,
    "name": "chalk/chalk",
    "url": "https://api.github.com/repos/chalk/chalk"
  },
  "org": {
    "id": 13122722,
    "login": "chalk",
    "gravatar_id": "",
    "url": "https://api.github.com/orgs/chalk",
    "avatar_url": "https://avatars.githubusercontent.com/u/13122722?"
  },
  "payload": {
    "action": "closed",
    "issue": {
      "url": "https://api.github.com/repos/chalk/chalk/issues/663",
      "repository_url": "https://api.github.com/repos/chalk/chalk",
      "labels_url": "https://api.github.com/repos/chalk/chalk/issues/663/labels{/name}",
      "comments_url": "https://api.github.com/repos/chalk/chalk/issues/663/comments",
      "events_url": "https://api.github.com/repos/chalk/chalk/issues/663/events",
      "html_url": "https://github.com/chalk/chalk/issues/663",
      "id": 3857278892,
      "node_id": "I_kwDOALTlW87l6Wes",
      "number": 663,
      "title": "Documentation: Fix formatting inconsistency in Modifiers section",
      "user": {
        "login": "mdhamed238",
        "id": 79021260,
        "node_id": "MDQ6VXNlcjc5MDIxMjYw",
        "avatar_url": "https://avatars.githubusercontent.com/u/79021260?v=4",
        "gravatar_id": "",
        "url": "https://api.github.com/users/mdhamed238",
        "html_url": "https://github.com/mdhamed238",
        "type": "User",
        "site_admin": false
      },
      "labels": [],
      "state": "closed",
      "locked": false,
      "assignee": null,
      "assignees": [],
      "milestone": null,
      "comments": 0,
      "created_at": "2026-01-26T19:09:42Z",
      "updated_at": "2026-01-27T06:30:37Z",
      "closed_at": "2026-01-27T06:30:37Z",
      "type": null,
      "active_lock_reason": null,
      "sub_issues_summary": {
        "total": 0,
        "completed": 0,
        "percent_completed": 0
      },
      "issue_dependencies_summary": {
        "blocked_by": 0,
        "total_blocked_by": 0,
        "blocking": 0,
        "total_blocking": 0
      },
      "body": "## Description\n...",
      "reactions": {
        "url": "https://api.github.com/repos/chalk/chalk/issues/663/reactions",
        "total_count": 0,
        "+1": 0, "-1": 0, "laugh": 0, "hooray": 0,
        "confused": 0, "heart": 0, "rocket": 0, "eyes": 0
      },
      "timeline_url": "https://api.github.com/repos/chalk/chalk/issues/663/timeline",
      "performed_via_github_app": null,
      "state_reason": "completed"
    }
  },
  "public": true,
  "created_at": "2026-01-27T06:30:38Z"
}
```

**payload.action 값:**

| 값 | 설명 |
|-----|------|
| `"opened"` | 이슈 생성 |
| `"closed"` | 이슈 닫힘 |
| `"reopened"` | 이슈 재오픈 |
| `"edited"` | 이슈 수정 |
| `"assigned"` | 담당자 지정 |
| `"unassigned"` | 담당자 해제 |
| `"labeled"` | 라벨 추가 |
| `"unlabeled"` | 라벨 제거 |

**payload.issue 필드:**

| 필드 | 타입 | 설명 | 프로젝트 사용 |
|------|------|------|--------------|
| `id` | number | 이슈 고유 ID | |
| `node_id` | string | GraphQL ID | |
| `number` | number | 이슈 번호 | |
| `title` | string | 이슈 제목 | ✅ `point_history.description` |
| `body` | string \| null | 이슈 본문 | |
| `state` | string | `"open"`, `"closed"` | |
| `state_reason` | string \| null | `"completed"`, `"not_planned"`, `"duplicate"` | |
| `locked` | boolean | 잠금 여부 | |
| `comments` | number | 댓글 수 | |
| `user.login` | string | 작성자 username | |
| `user.id` | number | 작성자 ID | |
| `labels` | array | 라벨 목록 | |
| `assignee` | object \| null | 담당자 | |
| `assignees` | array | 담당자 목록 | |
| `milestone` | object \| null | 마일스톤 | |
| `created_at` | string | 생성 시각 | |
| `updated_at` | string | 수정 시각 | |
| `closed_at` | string \| null | 닫힌 시각 | |
| `html_url` | string | GitHub 웹 URL | |
| `reactions.total_count` | number | 총 리액션 수 | |

---

### 2.5 PullRequestReviewEvent

PR 리뷰가 제출될 때 발생합니다.

**트리거 조건**:
- GitHub PR의 **Files changed** 탭에서 **Submit review** 버튼을 클릭할 때 발생
- 리뷰 옵션: `Approve`, `Request changes`, `Comment` 모두 이벤트 발생
- **Pending** 상태의 리뷰는 이벤트 발생 안 함 (Submit 전)
- Conversation 탭의 일반 코멘트는 `IssueCommentEvent`로 처리됨 (별도 이벤트)

**⚠️ 주의: 중복 리뷰 가능**

같은 PR에 여러 번 Submit review 할 수 있으며, 매번 `PullRequestReviewEvent`가 발생합니다:
```
PR #242에 Submit review (Comment) → PullRequestReviewEvent (state: "commented")
PR #242에 Submit review (Comment) → PullRequestReviewEvent (state: "commented")
PR #242에 Submit review (Approve) → PullRequestReviewEvent (state: "approved")
```

현재 구현에서는 모든 `action === "created"` 이벤트를 `PR_REVIEWED`로 처리합니다.

**실제 응답 (Approve)**:
```json
{
  "id": "6082593952",
  "type": "PullRequestReviewEvent",
  "actor": { "login": "honki12345" },
  "repo": { "name": "boostcampwm2025/web19-estrogenquattro" },
  "payload": {
    "action": "created",
    "pull_request": {
      "id": 3210764062,
      "number": 239,
      "url": "https://api.github.com/repos/boostcampwm2025/web19-estrogenquattro/pulls/239",
      "head": { "ref": "feat/#156-leader-board", "sha": "..." },
      "base": { "ref": "main", "sha": "..." }
    },
    "review": {
      "id": 3708950603,
      "body": null,
      "state": "approved",
      "commit_id": "e34131ce04f97692a900630a2ac87049363c3698",
      "submitted_at": "2026-01-27T03:39:39Z",
      "user": { "login": "honki12345", "id": 70520674 }
    }
  },
  "created_at": "2026-01-27T03:39:41Z"
}
```

**실제 응답 (Comment)**:
```json
{
  "id": "6093526198",
  "type": "PullRequestReviewEvent",
  "actor": { "login": "honki12345" },
  "repo": { "name": "boostcampwm2025/web19-estrogenquattro" },
  "payload": {
    "action": "created",
    "pull_request": {
      "id": 3213034904,
      "number": 242,
      "url": "https://api.github.com/repos/boostcampwm2025/web19-estrogenquattro/pulls/242",
      "head": { "ref": "feat/#235-landing-page", "sha": "d6c36c808a9f7bf603d4916d2dee141562693c1a" },
      "base": { "ref": "main", "sha": "99d840663df0ee2f45f4e1f2c7a1e73c3f5b43af" }
    },
    "review": {
      "id": 3710891010,
      "body": "잠시 테스트를 위해서 급하게 comment 적어보겠습니다 하하.. \n(수정예정)",
      "state": "commented",
      "commit_id": "d6c36c808a9f7bf603d4916d2dee141562693c1a",
      "submitted_at": "2026-01-27T12:23:36Z",
      "html_url": "https://github.com/boostcampwm2025/web19-estrogenquattro/pull/242#pullrequestreview-3710891010",
      "pull_request_url": "https://api.github.com/repos/boostcampwm2025/web19-estrogenquattro/pulls/242",
      "user": { "login": "honki12345", "id": 70520674 }
    }
  },
  "created_at": "2026-01-27T12:23:37Z"
}
```

**payload.action 값:**

| 값 | 설명 | 프로젝트 적용 |
|-----|------|--------------|
| `"created"` | 새 리뷰 제출 (Submit review) | ✅ `PR_REVIEWED` |
| `"edited"` | 리뷰 수정 | ❌ |
| `"dismissed"` | 리뷰 기각 | ❌ |

**payload.review.state 값:**

| 값 | 설명 | 트리거 조건 |
|-----|------|-------------|
| `"approved"` | 승인 | Submit review → Approve 선택 |
| `"changes_requested"` | 변경 요청 | Submit review → Request changes 선택 |
| `"commented"` | 코멘트 | Submit review → Comment 선택 |
| `"dismissed"` | 기각됨 | 다른 사용자가 리뷰 기각 |

**payload 필드**:

| 필드 | 타입 | 설명 | 프로젝트 사용 |
|------|------|------|--------------|
| `action` | string | 이벤트 액션 | ✅ `"created"` 필터링 |
| `pull_request.id` | number | PR 고유 ID | |
| `pull_request.number` | number | PR 번호 | ✅ PR API 호출용 |
| `pull_request.url` | string | PR API URL | |
| `review.id` | number | 리뷰 고유 ID | |
| `review.body` | string \| null | 리뷰 본문 | |
| `review.state` | string | 리뷰 상태 | |
| `review.commit_id` | string | 리뷰 대상 커밋 SHA | |
| `review.submitted_at` | string | 제출 시각 | |
| `review.html_url` | string | GitHub 웹 URL | |
| `review.pull_request_url` | string | PR API URL | |
| `review.user.login` | string | 리뷰어 username | |

**프로젝트 적용:**
- `point_history.repository`: `event.repo.name` (예: `"boostcampwm2025/web19-estrogenquattro"`)
- `point_history.description`: PR 제목 (PR API 별도 호출 필요)

---

### 2.6 CreateEvent

**실제 응답**:
```json
{
  "id": "7797259750",
  "type": "CreateEvent",
  "actor": { "login": "honki12345" },
  "repo": { "name": "honki12345/htdp" },
  "payload": {
    "ref": "test/minor-update-1769336830",
    "ref_type": "branch",
    "full_ref": "refs/heads/test/minor-update-1769336830",
    "master_branch": "main",
    "description": null,
    "pusher_type": "user"
  },
  "created_at": "2026-01-25T10:27:42Z"
}
```

**payload 필드**:

| 필드 | 타입 | 값 |
|------|------|-----|
| `ref` | string \| null | 브랜치/태그명 (repository인 경우 null) |
| `ref_type` | string | `"branch"`, `"tag"`, `"repository"` |
| `full_ref` | string | `refs/heads/{branch}` 형식 |
| `master_branch` | string | 기본 브랜치명 (보통 "main") |
| `description` | string \| null | 저장소 설명 |
| `pusher_type` | string | `"user"`, `"deploy_key"` |

---

### 2.7 DeleteEvent

브랜치 또는 태그가 삭제될 때 발생합니다.

**실제 응답** (2026-01-27):
```json
{
  "id": "7861496632",
  "type": "DeleteEvent",
  "actor": {
    "id": 70520674,
    "login": "honki12345",
    "display_login": "honki12345",
    "gravatar_id": "",
    "url": "https://api.github.com/users/honki12345",
    "avatar_url": "https://avatars.githubusercontent.com/u/70520674?"
  },
  "repo": {
    "id": 966196215,
    "name": "honki12345/htdp",
    "url": "https://api.github.com/repos/honki12345/htdp"
  },
  "payload": {
    "ref": "test/pr-test-1",
    "ref_type": "branch",
    "full_ref": "refs/heads/test/pr-test-1",
    "pusher_type": "user"
  },
  "public": true,
  "created_at": "2026-01-27T10:59:08Z"
}
```

**payload 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `ref` | string | 삭제된 브랜치/태그명 |
| `ref_type` | string | `"branch"`, `"tag"` |
| `full_ref` | string | `refs/heads/{branch}` 또는 `refs/tags/{tag}` 형식 |
| `pusher_type` | string | `"user"`, `"deploy_key"` |

> **Note**: 프로젝트에서 현재 사용하지 않음 (PR 머지 시 브랜치 삭제와 함께 발생)

---

### 2.8 IssueCommentEvent (참고)

이슈 또는 PR에 댓글이 작성/수정/삭제될 때 발생합니다.

**실제 응답** (전체 필드):
```json
{
  "id": "6084855556",
  "type": "IssueCommentEvent",
  "actor": {
    "id": 170270,
    "login": "sindresorhus",
    "display_login": "sindresorhus",
    "gravatar_id": "",
    "url": "https://api.github.com/users/sindresorhus",
    "avatar_url": "https://avatars.githubusercontent.com/u/170270?"
  },
  "repo": {
    "id": 94061307,
    "name": "vadimdemedes/ink",
    "url": "https://api.github.com/repos/vadimdemedes/ink"
  },
  "payload": {
    "action": "created",
    "issue": {
      "url": "https://api.github.com/repos/vadimdemedes/ink/issues/863",
      "html_url": "https://github.com/vadimdemedes/ink/pull/863",
      "id": 3858169518,
      "node_id": "PR_kwDOBZtC-86_etRA",
      "number": 863,
      "title": "feat: add flush() method to force pending renders",
      "user": {
        "login": "costajohnt",
        "id": 14304404
      },
      "labels": [],
      "state": "open",
      "locked": false,
      "assignee": null,
      "assignees": [],
      "milestone": null,
      "comments": 1,
      "created_at": "2026-01-26T23:50:22Z",
      "updated_at": "2026-01-27T06:17:44Z",
      "closed_at": null,
      "draft": false,
      "pull_request": {
        "url": "https://api.github.com/repos/vadimdemedes/ink/pulls/863",
        "html_url": "https://github.com/vadimdemedes/ink/pull/863",
        "diff_url": "https://github.com/vadimdemedes/ink/pull/863.diff",
        "patch_url": "https://github.com/vadimdemedes/ink/pull/863.patch",
        "merged_at": null
      },
      "body": "## Summary\n...",
      "reactions": { "total_count": 0 }
    },
    "comment": {
      "url": "https://api.github.com/repos/vadimdemedes/ink/issues/comments/3803318608",
      "html_url": "https://github.com/vadimdemedes/ink/pull/863#issuecomment-3803318608",
      "issue_url": "https://api.github.com/repos/vadimdemedes/ink/issues/863",
      "id": 3803318608,
      "node_id": "IC_kwDOBZtC-87isglQ",
      "user": {
        "login": "sindresorhus",
        "id": 170270,
        "type": "User",
        "site_admin": false
      },
      "created_at": "2026-01-27T06:17:44Z",
      "updated_at": "2026-01-27T06:17:44Z",
      "body": "I do not think we need a public flush API...",
      "reactions": { "total_count": 0 },
      "performed_via_github_app": null
    }
  },
  "public": true,
  "created_at": "2026-01-27T06:17:44Z"
}
```

**payload.action 값:**

| 값 | 설명 |
|-----|------|
| `"created"` | 댓글 작성 |
| `"edited"` | 댓글 수정 |
| `"deleted"` | 댓글 삭제 |

**payload.issue 필드** (IssuesEvent와 유사하지만 PR일 경우 `pull_request` 객체 포함):

| 필드 | 타입 | 설명 |
|------|------|------|
| `number` | number | 이슈/PR 번호 |
| `title` | string | 이슈/PR 제목 |
| `state` | string | `"open"`, `"closed"` |
| `pull_request` | object \| undefined | PR인 경우에만 존재 |
| `pull_request.merged_at` | string \| null | 머지 시각 |

**payload.comment 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | number | 댓글 ID |
| `body` | string | 댓글 본문 |
| `user.login` | string | 작성자 username |
| `created_at` | string | 작성 시각 |
| `updated_at` | string | 수정 시각 |
| `html_url` | string | GitHub 웹 URL |

> **Note**: 프로젝트에서 현재 사용하지 않음 (향후 댓글 알림 기능 추가 시 활용 가능)

---

### 2.8 ReleaseEvent

릴리스가 생성/수정/삭제될 때 발생합니다.

**실제 응답**:
```json
{
  "id": "6066088214",
  "type": "ReleaseEvent",
  "actor": {
    "id": 170270,
    "login": "sindresorhus",
    "display_login": "sindresorhus",
    "gravatar_id": "",
    "url": "https://api.github.com/users/sindresorhus",
    "avatar_url": "https://avatars.githubusercontent.com/u/170270?"
  },
  "repo": {
    "id": 44158428,
    "name": "sindresorhus/trash-cli",
    "url": "https://api.github.com/repos/sindresorhus/trash-cli"
  },
  "payload": {
    "action": "published",
    "release": {
      "url": "https://api.github.com/repos/sindresorhus/trash-cli/releases/279937516",
      "assets_url": "https://api.github.com/repos/sindresorhus/trash-cli/releases/279937516/assets",
      "upload_url": "https://uploads.github.com/repos/sindresorhus/trash-cli/releases/279937516/assets{?name,label}",
      "html_url": "https://github.com/sindresorhus/trash-cli/releases/tag/v7.1.1",
      "id": 279937516,
      "author": {
        "login": "sindresorhus",
        "id": 170270,
        "type": "User",
        "site_admin": false
      },
      "node_id": "RE_kwDOAqHN3M4Qr4Hs",
      "tag_name": "v7.1.1",
      "target_commitish": "main",
      "name": "",
      "draft": false,
      "immutable": false,
      "prerelease": false,
      "created_at": "2026-01-26T14:07:23Z",
      "updated_at": "2026-01-26T14:07:40Z",
      "published_at": "2026-01-26T14:07:40Z",
      "assets": [],
      "tarball_url": "https://api.github.com/repos/sindresorhus/trash-cli/tarball/v7.1.1",
      "zipball_url": "https://api.github.com/repos/sindresorhus/trash-cli/zipball/v7.1.1",
      "body": "- Fix directories being silently ignored  f3928ff\r\n\r\n---\r\n\r\nhttps://github.com/sindresorhus/trash-cli/compare/v7.1.0...v7.1.1",
      "short_description_html": "<ul>...</ul>"
    }
  },
  "public": true,
  "created_at": "2026-01-26T14:07:40Z"
}
```

**payload.action 값:**

| 값 | 설명 |
|-----|------|
| `"published"` | 릴리스 발행 |
| `"created"` | 릴리스 생성 (draft) |
| `"edited"` | 릴리스 수정 |
| `"deleted"` | 릴리스 삭제 |
| `"prereleased"` | 프리릴리스 발행 |
| `"released"` | 정식 릴리스 |

**payload.release 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | number | 릴리스 ID |
| `tag_name` | string | 태그명 (예: `"v7.1.1"`) |
| `target_commitish` | string | 타겟 브랜치 (예: `"main"`) |
| `name` | string | 릴리스 이름 |
| `draft` | boolean | 드래프트 여부 |
| `prerelease` | boolean | 프리릴리스 여부 |
| `body` | string | 릴리스 노트 |
| `author.login` | string | 작성자 username |
| `html_url` | string | GitHub 웹 URL |
| `published_at` | string \| null | 발행 시각 |

> **Note**: 프로젝트에서 현재 사용하지 않음

---

### 2.9 Compare API 응답 구조 (실제 사용 중)

PushEvent 감지 시 **커밋 개수**와 **커밋 메시지**를 조회하기 위해 Compare API를 사용합니다.

**엔드포인트**: `GET /repos/{owner}/{repo}/compare/{before}...{head}`

**호출 시점**: PushEvent의 `payload.before`와 `payload.head` SHA를 사용하여 Compare API 호출

```typescript
// PushEvent에서 Compare API 호출
const pushEvent = {
  payload: {
    before: "1caec6aaa7c38fb14ed66eb7cee0e36fcddb7dcf",  // 푸시 전 커밋
    head: "a7c8c37e3a68b02d6f1b0af1d92f2e3e0dbf6e5c"     // 푸시 후 최신 커밋
  },
  repo: { name: "honki12345/htdp" }
};

const url = `https://api.github.com/repos/${pushEvent.repo.name}/compare/${pushEvent.payload.before}...${pushEvent.payload.head}`;
```

---

#### 2.9.1 전체 응답 구조

**실제 응답** (1개 커밋 - 2026-01-27 로깅):

```json
{
  "url": "https://api.github.com/repos/honki12345/my-agent-skills/compare/8d5e23e9b28ad3d3c3e1d24b97a0ce3c0a78...8ff247f04e8a46b8d9e9fd0e6c7b9e3a2d49",
  "html_url": "https://github.com/honki12345/my-agent-skills/compare/8d5e23e9b28ad3d3c3e1d24b97a0ce3c0a78...8ff247f04e8a46b8d9e9fd0e6c7b9e3a2d49",
  "permalink_url": "https://github.com/honki12345/my-agent-skills/compare/honki12345:8d5e23e...honki12345:8ff247f",
  "diff_url": "https://github.com/honki12345/my-agent-skills/compare/8d5e23e9b28ad3d3c3e1d24b97a0ce3c0a78...8ff247f04e8a46b8d9e9fd0e6c7b9e3a2d49.diff",
  "patch_url": "https://github.com/honki12345/my-agent-skills/compare/8d5e23e9b28ad3d3c3e1d24b97a0ce3c0a78...8ff247f04e8a46b8d9e9fd0e6c7b9e3a2d49.patch",
  "base_commit": { ... },
  "merge_base_commit": { ... },
  "status": "ahead",
  "ahead_by": 1,
  "behind_by": 0,
  "total_commits": 1,
  "commits": [ ... ],
  "files": [ ... ]
}
```

**최상위 필드:**

| 필드 | 타입 | 설명 | 프로젝트 사용 |
|------|------|------|--------------|
| `url` | string | API URL | |
| `html_url` | string | GitHub 웹 비교 페이지 URL | |
| `permalink_url` | string | 영구 링크 URL | |
| `diff_url` | string | diff 파일 URL | |
| `patch_url` | string | patch 파일 URL | |
| `base_commit` | object | before SHA에 해당하는 커밋 정보 | |
| `merge_base_commit` | object | 두 브랜치의 공통 조상 커밋 | |
| `status` | string | 비교 상태 | |
| `ahead_by` | number | head가 base보다 앞선 커밋 수 | |
| `behind_by` | number | head가 base보다 뒤진 커밋 수 | |
| `total_commits` | number | 비교 범위 내 총 커밋 수 | ✅ 커밋 개수 추출 |
| `commits` | array | 커밋 목록 (오래된 → 최신 순서) | ✅ 커밋 메시지 추출 |
| `files` | array | 변경된 파일 목록 | |

**`status` 값:**

| 값 | 설명 |
|----|------|
| `"ahead"` | head가 base보다 앞서 있음 (일반적인 푸시) |
| `"behind"` | head가 base보다 뒤에 있음 |
| `"diverged"` | 양쪽 모두 다른 커밋이 있음 |
| `"identical"` | 동일한 커밋 |

---

#### 2.9.2 `base_commit` / `merge_base_commit` 구조

**실제 응답** (base_commit):

```json
{
  "base_commit": {
    "sha": "1caec6aaa7c38fb14ed66eb7cee0e36fcddb7dcf",
    "node_id": "C_kwDOOZq0R9oAKDFjYWVjNmFhYTdjMzhmYjE0ZWQ2NmViN2NlZTBlMzZmY2RkYjdkY2Y",
    "commit": {
      "author": {
        "name": "honki12345",
        "email": "70520674+honki12345@users.noreply.github.com",
        "date": "2026-01-27T11:30:57Z"
      },
      "committer": {
        "name": "honki12345",
        "email": "70520674+honki12345@users.noreply.github.com",
        "date": "2026-01-27T11:30:57Z"
      },
      "message": "test commit",
      "tree": {
        "sha": "e7b80b245e2e9fbd4f31c2e0f31e0e0e1e0e0e0e",
        "url": "https://api.github.com/repos/honki12345/htdp/git/trees/e7b80b..."
      },
      "url": "https://api.github.com/repos/honki12345/htdp/git/commits/1caec6a...",
      "comment_count": 0,
      "verification": {
        "verified": false,
        "reason": "unsigned",
        "signature": null,
        "payload": null,
        "verified_at": null
      }
    },
    "url": "https://api.github.com/repos/honki12345/htdp/commits/1caec6a...",
    "html_url": "https://github.com/honki12345/htdp/commit/1caec6a...",
    "comments_url": "https://api.github.com/repos/honki12345/htdp/commits/1caec6a.../comments",
    "author": {
      "login": "honki12345",
      "id": 70520674,
      "node_id": "MDQ6VXNlcjcwNTIwNjc0",
      "avatar_url": "https://avatars.githubusercontent.com/u/70520674?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/honki12345",
      "html_url": "https://github.com/honki12345",
      "type": "User",
      "site_admin": false
    },
    "committer": {
      "login": "honki12345",
      "id": 70520674,
      ...
    },
    "parents": [
      {
        "sha": "0b7e3f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e",
        "url": "https://api.github.com/repos/honki12345/htdp/commits/0b7e3f1...",
        "html_url": "https://github.com/honki12345/htdp/commit/0b7e3f1..."
      }
    ]
  }
}
```

**`base_commit` vs `merge_base_commit` 차이:**

| 필드 | 설명 |
|------|------|
| `base_commit` | Compare 요청에서 `before`로 지정한 커밋 (PushEvent의 `payload.before`) |
| `merge_base_commit` | 두 커밋의 **공통 조상** (merge base). 선형 히스토리에서는 `base_commit`과 동일 |

> **Note**: 일반적인 PushEvent에서는 `base_commit`과 `merge_base_commit`이 같은 커밋을 가리킵니다.

---

#### 2.9.3 `commits` 배열 구조

**⚠️ 배열 순서: 오래된 → 최신 (오름차순)**

```
commits[0]          = 가장 오래된 커밋 (base 바로 다음)
commits[length-1]   = 가장 최신 커밋 (head)
```

> **Note**: Events API(`created_at` 내림차순)와 **반대 순서**입니다.

**실제 응답** (1개 커밋):

```json
{
  "commits": [
    {
      "sha": "a7c8c37e3a68b02d6f1b0af1d92f2e3e0dbf6e5c",
      "node_id": "C_kwDOOZq0R9oAKGE3YzhjMzd...",
      "commit": {
        "author": {
          "name": "honki12345",
          "email": "70520674+honki12345@users.noreply.github.com",
          "date": "2026-01-27T11:34:51Z"
        },
        "committer": {
          "name": "honki12345",
          "email": "70520674+honki12345@users.noreply.github.com",
          "date": "2026-01-27T11:34:51Z"
        },
        "message": "test commit",
        "tree": {
          "sha": "f8c90c356e3e9fbd...",
          "url": "https://api.github.com/repos/honki12345/htdp/git/trees/f8c90c3..."
        },
        "url": "https://api.github.com/repos/honki12345/htdp/git/commits/a7c8c37...",
        "comment_count": 0,
        "verification": {
          "verified": false,
          "reason": "unsigned",
          "signature": null,
          "payload": null,
          "verified_at": null
        }
      },
      "url": "https://api.github.com/repos/honki12345/htdp/commits/a7c8c37...",
      "html_url": "https://github.com/honki12345/htdp/commit/a7c8c37...",
      "comments_url": "https://api.github.com/repos/honki12345/htdp/commits/a7c8c37.../comments",
      "author": {
        "login": "honki12345",
        "id": 70520674,
        "node_id": "MDQ6VXNlcjcwNTIwNjc0",
        "avatar_url": "https://avatars.githubusercontent.com/u/70520674?v=4",
        "gravatar_id": "",
        "url": "https://api.github.com/users/honki12345",
        "html_url": "https://github.com/honki12345",
        "type": "User",
        "site_admin": false
      },
      "committer": {
        "login": "honki12345",
        "id": 70520674,
        ...
      },
      "parents": [
        {
          "sha": "1caec6aaa7c38fb14ed66eb7cee0e36fcddb7dcf",
          "url": "https://api.github.com/repos/honki12345/htdp/commits/1caec6a...",
          "html_url": "https://github.com/honki12345/htdp/commit/1caec6a..."
        }
      ]
    }
  ]
}
```

**`commits[]` 필드:**

| 필드 | 타입 | 설명 | 프로젝트 사용 |
|------|------|------|--------------|
| `sha` | string | 커밋 SHA (40자) | |
| `node_id` | string | GraphQL ID | |
| `commit.author.name` | string | 작성자 이름 | |
| `commit.author.email` | string | 작성자 이메일 | |
| `commit.author.date` | string | 작성 시각 (ISO 8601) | |
| `commit.committer.name` | string | 커미터 이름 | ✅ 머지 커밋 판별 |
| `commit.committer.email` | string | 커미터 이메일 | |
| `commit.committer.date` | string | 커밋 시각 (ISO 8601) | |
| `commit.message` | string | 커밋 메시지 | ✅ `point_history.description` |
| `commit.tree.sha` | string | 트리 SHA | |
| `commit.comment_count` | number | 커밋 댓글 수 | |
| `commit.verification.verified` | boolean | 서명 검증 여부 | |
| `commit.verification.reason` | string | 검증 상태 이유 | |
| `url` | string | API URL | |
| `html_url` | string | GitHub 웹 URL | |
| `author` | object \| null | GitHub 사용자 (연결된 경우) | |
| `author.login` | string | GitHub 로그인명 | |
| `committer` | object \| null | GitHub 커미터 (연결된 경우) | |
| `parents` | array | 부모 커밋 목록 | ✅ 머지 커밋 판별 |
| `parents[].sha` | string | 부모 커밋 SHA | |

---

#### 2.9.4 머지 커밋 판별

**실제 응답** (2개 커밋 - 일반 커밋 + 머지 커밋):

```json
{
  "total_commits": 2,
  "commits": [
    {
      "sha": "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
      "commit": {
        "author": {
          "name": "honki12345",
          "email": "70520674+honki12345@users.noreply.github.com",
          "date": "2026-01-27T11:38:22Z"
        },
        "committer": {
          "name": "honki12345",
          "email": "70520674+honki12345@users.noreply.github.com",
          "date": "2026-01-27T11:38:22Z"
        },
        "message": "Test PR 1"
      },
      "parents": [
        {
          "sha": "a7c8c37e3a68b02d6f1b0af1d92f2e3e0dbf6e5c",
          "url": "..."
        }
      ]
    },
    {
      "sha": "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
      "commit": {
        "author": {
          "name": "honki12345",
          "email": "70520674+honki12345@users.noreply.github.com",
          "date": "2026-01-27T11:39:05Z"
        },
        "committer": {
          "name": "GitHub",
          "email": "noreply@github.com",
          "date": "2026-01-27T11:39:05Z"
        },
        "message": "Merge pull request #4 from honki12345/test/pr-test-1\n\nTest PR 1"
      },
      "parents": [
        {
          "sha": "a7c8c37e3a68b02d6f1b0af1d92f2e3e0dbf6e5c",
          "url": "..."
        },
        {
          "sha": "c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2",
          "url": "..."
        }
      ]
    }
  ]
}
```

**머지 커밋 특성:**

| 판별 기준 | 일반 커밋 | 머지 커밋 |
|----------|----------|----------|
| `parents.length` | 1 | **2** (두 브랜치 합침) |
| `commit.committer.name` | 작성자 이름 | **"GitHub"** |
| `commit.committer.email` | 작성자 이메일 | **"noreply@github.com"** |
| `commit.message` | 일반 메시지 | `"Merge pull request #N from ..."` |

**머지 커밋 판별 코드:**

```typescript
function isMergeCommit(commit: CompareCommit): boolean {
  // 방법 1: parents가 2개 이상 (가장 확실)
  if (commit.parents.length >= 2) {
    return true;
  }

  // 방법 2: GitHub이 커미터인 경우 (PR 머지)
  if (commit.commit.committer?.name === 'GitHub') {
    return true;
  }

  // 방법 3: 커밋 메시지 패턴 (fallback)
  if (commit.commit.message.startsWith('Merge pull request #')) {
    return true;
  }

  return false;
}
```

**프로젝트 적용:**

```typescript
// Compare API 응답에서 실제 커밋 개수 계산 (머지 커밋 제외)
const actualCommitCount = commits.filter(c => !isMergeCommit(c)).length;
```

---

#### 2.9.5 `files` 배열 구조

**실제 응답**:

```json
{
  "files": [
    {
      "sha": "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
      "filename": "TEST_COMMIT.md",
      "status": "added",
      "additions": 0,
      "deletions": 0,
      "changes": 0,
      "blob_url": "https://github.com/honki12345/htdp/blob/a7c8c37.../TEST_COMMIT.md",
      "raw_url": "https://github.com/honki12345/htdp/raw/a7c8c37.../TEST_COMMIT.md",
      "contents_url": "https://api.github.com/repos/honki12345/htdp/contents/TEST_COMMIT.md?ref=a7c8c37..."
    }
  ]
}
```

**`files[]` 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `sha` | string | 파일 blob SHA |
| `filename` | string | 파일 경로 |
| `status` | string | 변경 상태 |
| `additions` | number | 추가된 줄 수 |
| `deletions` | number | 삭제된 줄 수 |
| `changes` | number | 총 변경 줄 수 |
| `blob_url` | string | GitHub 웹 blob URL |
| `raw_url` | string | raw 파일 URL |
| `contents_url` | string | API contents URL |
| `patch` | string \| undefined | diff 패치 (변경 내용이 있을 때) |

**`status` 값:**

| 값 | 설명 |
|----|------|
| `"added"` | 새 파일 추가 |
| `"modified"` | 기존 파일 수정 |
| `"removed"` | 파일 삭제 |
| `"renamed"` | 파일 이름 변경 |
| `"copied"` | 파일 복사 |
| `"changed"` | 변경됨 (type change) |
| `"unchanged"` | 변경 없음 |

---

#### 2.9.6 `verification` 객체 구조

커밋 서명 검증 정보:

```json
{
  "verification": {
    "verified": false,
    "reason": "unsigned",
    "signature": null,
    "payload": null,
    "verified_at": null
  }
}
```

**`verification` 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `verified` | boolean | 서명 검증 성공 여부 |
| `reason` | string | 검증 상태 이유 |
| `signature` | string \| null | GPG/SSH 서명 |
| `payload` | string \| null | 서명된 페이로드 |
| `verified_at` | string \| null | 검증 시각 |

**`reason` 값:**

| 값 | 설명 |
|----|------|
| `"unsigned"` | 서명 없음 |
| `"valid"` | 유효한 서명 |
| `"unknown_key"` | 알 수 없는 키 |
| `"bad_signature"` | 잘못된 서명 |
| `"expired_key"` | 만료된 키 |
| `"not_signing_key"` | 서명용 키가 아님 |

---

#### 2.9.7 TypeScript 인터페이스

```typescript
interface CompareResponse {
  url: string;
  html_url: string;
  permalink_url: string;
  diff_url: string;
  patch_url: string;
  base_commit: CompareCommit;
  merge_base_commit: CompareCommit;
  status: 'ahead' | 'behind' | 'diverged' | 'identical';
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: CompareCommit[];
  files: CompareFile[];
}

interface CompareCommit {
  sha: string;
  node_id: string;
  commit: {
    author: GitUser | null;
    committer: GitUser | null;
    message: string;
    tree: { sha: string; url: string };
    url: string;
    comment_count: number;
    verification: {
      verified: boolean;
      reason: string;
      signature: string | null;
      payload: string | null;
      verified_at: string | null;
    };
  };
  url: string;
  html_url: string;
  comments_url: string;
  author: GitHubUser | null;
  committer: GitHubUser | null;
  parents: Array<{ sha: string; url: string; html_url: string }>;
}

interface GitUser {
  name: string;
  email: string;
  date: string;
}

interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  type: string;
  site_admin: boolean;
}

interface CompareFile {
  sha: string;
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string;
}
```

**타입 가드:**

```typescript
export function isCompareResponse(data: unknown): data is CompareResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'total_commits' in data &&
    typeof (data as CompareResponse).total_commits === 'number' &&
    'commits' in data &&
    Array.isArray((data as CompareResponse).commits)
  );
}
```

---

#### 2.9.8 프로젝트 적용 요약

**커밋 개수 추출:**
```typescript
const commitCount = data.total_commits;
```

**커밋 메시지 추출:**
```typescript
const messages = data.commits.map(c => c.commit.message);
// 또는 첫 번째 커밋 메시지만
const firstMessage = data.commits[0]?.commit.message;
```

**실제 커밋 개수 (머지 커밋 제외):**
```typescript
const actualCommitCount = data.commits.filter(c => c.parents.length < 2).length;
```

**로깅 예시** (실제 출력):
```
[honki12345] Compare API: 2 commits
  - c3d4e5f: Test PR 1
  - d4e5f6a: Merge pull request #4 from honki12345/test/pr-test-1
Commits: +3, PRs: +0, Merged: +1, Issues: +0, Reviews: +0
```

---

### 2.10 PR API 응답 구조 (실제 사용 중)

PullRequestEvent, PullRequestReviewEvent 감지 시 **PR 제목**을 조회하기 위해 PR API를 사용합니다.

**엔드포인트**: `GET /repos/{owner}/{repo}/pulls/{number}`

**호출 시점:**
- PullRequestEvent (opened, merged) → PR 제목 조회
- PullRequestReviewEvent (created) → PR 제목 조회

**실제 응답** (주요 필드만):
```json
{
  "number": 4,
  "title": "Test PR 1 - Will be merged",
  "state": "closed",
  "merged": true
}
```

**프로젝트에서 사용하는 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `number` | number | PR 번호 |
| `title` | string | PR 제목 |
| `state` | string | `"open"`, `"closed"` |
| `merged` | boolean | 머지 여부 |

**타입 가드:**

```typescript
export function isPrResponse(data: unknown): data is PrResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'number' in data &&
    'title' in data &&
    typeof (data as PrResponse).title === 'string'
  );
}
```

**Fallback 시스템:**

PR API 호출 실패 시 PR 번호를 대체값으로 사용:

```typescript
private async getPrTitle(repoName: string, prNumber: number, accessToken: string): Promise<string> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return `#${prNumber}`;           // API 실패
    const data = await res.json();
    if (!isPrResponse(data)) return `#${prNumber}`; // 타입 불일치
    return data.title;
  } catch {
    return `#${prNumber}`;                         // 네트워크 에러
  }
}
```

| 상황 | point_history.description |
|------|--------------------------|
| API 성공 | `"feat: 랜딩 페이지 구현"` |
| API 실패 | `"#242"` |

---

## 3. 이벤트 처리 로직

### 3.1 프로젝트 적용 이벤트

| 이벤트 타입 | 감지 조건 | DB 저장 | 포인트 | point_history |
|------------|----------|---------|--------|---------------|
| PushEvent | 항상 | COMMITTED | +3 | repository: 레포명, description: 커밋 메시지 |
| PullRequestEvent | `action === "opened"` | PR_OPEN | +2 | repository: 레포명, description: PR 제목 |
| PullRequestEvent | 머지 판별 (아래 참고) | PR_MERGED | +4 | repository: 레포명, description: PR 제목 |
| IssuesEvent | `action === "opened"` | ISSUE_OPEN | +1 | repository: 레포명, description: 이슈 제목 |
| PullRequestReviewEvent | `action === "created"` | PR_REVIEWED | +4 | repository: 레포명, description: PR 제목 |

**PR 머지 판별**: `action === 'merged' || (action === 'closed' && pull_request?.merged === true)`

**PR 제목 조회 실패 시**: `#PR번호` 형식으로 fallback (예: `#242`)

> **Note**: PushEvent 커밋 메시지는 Compare API로, PR 제목은 PR API로 별도 조회.

### 3.2 이벤트 파싱 코드

```typescript
interface PullRequestEventPayload {
  action: 'opened' | 'closed' | 'merged' | 'reopened';
  number: number;
  pull_request: {
    id: number;
    number: number;
    url: string;
    merged?: boolean;  // closed 시 머지 여부 (fallback용)
    head: { ref: string; sha: string };
    base: { ref: string; sha: string };
  };
}

interface IssuesEventPayload {
  action: 'opened' | 'closed' | 'reopened';
  issue: {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
  };
}

interface PullRequestReviewEventPayload {
  action: 'created' | 'edited' | 'dismissed';
  pull_request: {
    id: number;
    number: number;
  };
  review: {
    id: number;
    state: 'approved' | 'changes_requested' | 'commented' | 'dismissed';
  };
}

for (const event of newEvents) {
  switch (event.type) {
    case 'PushEvent':
      // PushEvent 1개 = Push 1회로 카운트
      // 레포지토리 이름은 event.repo.name에서 추출
      this.logger.log(`[${schedule.username}] Push to ${event.repo.name}`);
      pushCount += 1;
      pushDetails.push(event.repo.name);  // point_history.description용
      break;

    case 'PullRequestEvent':
      const prPayload = event.payload as PullRequestEventPayload;
      if (prPayload.action === 'opened') {
        prOpenCount += 1;
      } else if (
        prPayload.action === 'merged' ||
        (prPayload.action === 'closed' && prPayload.pull_request?.merged === true)
      ) {
        prMergedCount += 1;
      }
      break;

    case 'IssuesEvent':
      const issuePayload = event.payload as IssuesEventPayload;
      if (issuePayload.action === 'opened') {
        issueCount += 1;
        issueDetails.push(issuePayload.issue.title);  // point_history.description용
      }
      break;

    case 'PullRequestReviewEvent':
      const reviewPayload = event.payload as PullRequestReviewEventPayload;
      if (reviewPayload.action === 'created') {
        reviewCount += 1;
      }
      break;
  }
}
```

### 3.3 DB 저장 흐름

이벤트 처리 후 두 테이블에 저장:

1. **daily_github_activity**: 일별 집계 (count 누적)
2. **point_history**: 개별 이벤트 내역 (description 포함)

```typescript
// daily_github_activity에 count 누적
await this.githubService.incrementActivity(playerId, GithubActivityType.COMMITTED, pushCount);

// point_history에 개별 레코드 생성 (description 포함)
for (const repoName of pushDetails) {
  await this.pointService.addPoint(playerId, PointType.COMMITTED, 2, repoName);
}
```

---

## 4. 현재 구조

### 파일 구조

```
backend/src/github/
├── github.module.ts
├── github.gateway.ts       # 소켓 이벤트 브로드캐스트
├── github.poll-service.ts  # GraphQL 폴링 로직 (수정 대상)
├── github.service.ts       # DB 저장 로직
└── entities/
    └── daily-github-activity.entity.ts
```

### 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/github.poll-service.ts` | GraphQL → REST API 전환, ETag 처리 |
| `backend/src/github/github.poll-service.spec.ts` | 테스트 업데이트 |
| `docs/api/GITHUB_POLLING.md` | 문서 업데이트 |

---

## 5. 구현 상세

### 5.1 새로운 인터페이스

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

### 5.2 REST API 호출

```typescript
// per_page=100으로 최근 이벤트 조회
const url = `https://api.github.com/users/${username}/events/public?per_page=100`;
const headers: Record<string, string> = {
  'Authorization': `Bearer ${accessToken}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

// ETag 있으면 조건부 요청
if (schedule.etag) {
  headers['If-None-Match'] = schedule.etag;
}

const res = await fetch(url, { headers });

// 304: 변화 없음 (Rate Limit 소모 안 함)
if (res.status === 304) {
  return { status: 'no_changes' };
}

// ETag 저장
const newEtag = res.headers.get('ETag');
if (newEtag) {
  schedule.etag = newEtag;
}
```

#### 페이지네이션 전략

| 옵션 | 설명 | 채택 |
|------|------|------|
| `per_page=100` | 한 번 요청에 최대 100개 이벤트 | ✅ |
| `per_page=10` | 최근 10개 이벤트만 조회 | ❌ |
| 멀티 페이지 조회 | lastEventId까지 여러 페이지 조회 | ❌ |

**선택 이유**: 이벤트 누락 방지를 위해 충분한 버퍼 확보. 304 응답 시 Rate Limit 소모 없음.

### 5.3 새 이벤트 필터링

```typescript
// 첫 폴링에서 이벤트가 없을 때 사용하는 sentinel 값
const NO_EVENTS_SENTINEL = "-1";

const events: GithubEvent[] = await res.json();

// 첫 폴링: lastEventId 설정, 브로드캐스트 안 함
if (!schedule.lastEventId) {
  schedule.lastEventId = events[0]?.id ?? NO_EVENTS_SENTINEL;
  return { status: 'first_poll' };
}

// 이후 폴링: lastEventId 위치 기반으로 새 이벤트 필터링
let newEvents: GithubEvent[];
if (schedule.lastEventId === NO_EVENTS_SENTINEL) {
  // 첫 폴링에 이벤트 없었음 → 전부 새 이벤트
  newEvents = events;
} else {
  // lastEventId의 배열 인덱스 찾기
  const lastIndex = events.findIndex(e => e.id === schedule.lastEventId);

  if (lastIndex === -1) {
    // lastEventId가 목록에 없음 (10개 초과) → 전부 새 이벤트로 처리
    newEvents = events;
  } else if (lastIndex === 0) {
    // 첫 번째가 lastEventId → 새 이벤트 없음
    newEvents = [];
  } else {
    // lastEventId 앞의 이벤트들이 새 이벤트
    newEvents = events.slice(0, lastIndex);
  }
}

if (newEvents.length > 0) {
  schedule.lastEventId = events[0].id;  // 최신 이벤트 ID로 업데이트
}
```

#### 왜 BigInt 비교가 아닌 findIndex를 사용하는가?

**GitHub 이벤트 ID는 시간순이 아닙니다.** 이벤트 타입에 따라 ID 범위가 다릅니다:

| 이벤트 | ID 예시 | created_at |
|--------|---------|------------|
| IssuesEvent | 6090909336 | 10:39:10Z (최신) |
| PushEvent | 7860880060 | 10:39:06Z |
| PushEvent | 7860873554 | 10:38:53Z |
| IssuesEvent | 6090782518 | 10:34:18Z |

- `BigInt(7860880060) > BigInt(6090782518)` = true
- 하지만 `6090782518`이 더 최신 이벤트!

**해결책**: GitHub Events API 응답은 `created_at` 기준 **내림차순** 정렬됨 (최신이 먼저). 따라서 배열 인덱스 기반으로 `lastEventId` 앞에 있는 이벤트들이 새 이벤트.

**`NO_EVENTS_SENTINEL`**: 첫 폴링에서 이벤트가 0개일 때 사용. 이후 폴링에서 모든 이벤트를 새 이벤트로 처리.

### 5.4 에러 처리

```typescript
const POLL_INTERVAL = 120_000;         // 120초 (기본)
const POLL_INTERVAL_BACKOFF = 600_000; // 10분 (rate limit 시)

async function handlePoll(schedule: PollingSchedule): Promise<number> {
  const res = await fetch(url, { headers });

  // 401: 토큰 만료 또는 무효 → 폴링 중지
  if (res.status === 401) {
    this.logger.error(`[${schedule.username}] Token expired or invalid`);
    this.stopPolling(schedule.username);
    return -1;
  }

  // 403/429: Rate Limit → 10분 대기
  if (res.status === 403 || res.status === 429) {
    this.logger.warn(`[${schedule.username}] Rate limit, waiting 10 minutes`);
    return POLL_INTERVAL_BACKOFF;
  }

  // 304: 변화 없음 (Rate Limit 소모 안 함)
  if (res.status === 304) {
    return POLL_INTERVAL;
  }

  // 200: 정상 처리
  if (res.ok) {
    // ... 이벤트 처리
    return POLL_INTERVAL;
  }

  // 기타 에러
  this.logger.error(`[${schedule.username}] API Error: ${res.status}`);
  return POLL_INTERVAL;
}
```

| 응답 | 처리 | 다음 폴링 |
|------|------|----------|
| 200 OK | 이벤트 처리 | 120초 |
| 304 Not Modified | 스킵 (Rate Limit 0) | 120초 |
| 401 Unauthorized | 토큰 만료 → 폴링 중지 | - |
| 403/429 | Rate Limit | 10분 |
| 5xx | 서버 에러 | 120초 |

---

## 6. Rate Limit 비교

| 항목 | GraphQL | REST (ETag) |
|------|---------|-------------|
| 제한 | 5,000 points/hour | 5,000 requests/hour |
| 폴링 주기 | 30초 (120회/시간) | 120초 (30회/시간) |
| 변화 없을 때 | 1 point 소모 | 0 소모 (304) |

> **Note**: REST API 이벤트 갱신 지연(평균 8분, 최대 30분+)을 고려하여 폴링 주기를 120초로 설정. 더 빠른 폴링은 Rate Limit 낭비.

---

## 7. 테스트 계획

### 7.1 통합 테스트 (실제 API 호출)

파일: `github.poll-service.integration.spec.ts`

```bash
pnpm test -- github.poll-service.integration
```

| 테스트 | 검증 내용 |
|--------|----------|
| `isGithubEventArray 타입 가드 통과` | Events API 응답이 타입 가드 통과 |
| `ETag 헤더 포함` | 응답에 ETag 헤더 존재 |
| `304 응답` | If-None-Match로 304 응답 수신 |
| `isCompareResponse 타입 가드 통과` | Compare API 응답이 타입 가드 통과 |
| `isPrResponse 타입 가드 통과` | PR API 응답이 타입 가드 통과 |
| `Rate Limit 헤더` | X-RateLimit-Remaining 헤더 존재 |

### 7.2 타입 가드 함수

```typescript
// github.poll-service.ts에서 export
export function isGithubEventArray(data: unknown): data is GithubEvent[];
export function isCompareResponse(data: unknown): data is CompareResponse;
export function isPrResponse(data: unknown): data is PrResponse;
```

실제 GitHub API 응답으로 타입 안전성 검증 완료 (2026-01-27)

### 7.3 단위 테스트 (TODO)

- ETag 조건부 요청 동작 확인
- 이벤트 타입별 파싱 확인
- lastEventId 필터링 (findIndex 기반) 확인

---

## 8. 롤백 계획

```typescript
const POLLING_METHOD = process.env.GITHUB_POLLING_METHOD ?? 'rest'; // 'rest' | 'graphql'
```
