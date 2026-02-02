# GitHub 활동 시간 저장 (point_history 컬럼 추가)

> **관련 이슈**: [#321](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/321)
> **작성일**: 2026-01-29
> **브랜치**: `feat/#321-activity-at`

---

## 참조한 문서

- [ISSUE_240_GRAPHQL_TO_REST_0127.md](ISSUE_240_GRAPHQL_TO_REST_0127.md): REST API 이벤트 타입별 필드 구조 상세 명세
- [docs/api/GITHUB_POLLING.md](../api/GITHUB_POLLING.md): GitHub REST Events API 응답 구조 및 `created_at` 필드 확인
- [docs/guides/ERD.md](../guides/ERD.md): point_history 테이블 현재 스키마 확인
- [docs/plan/done/ISSUE_234_GRAPHQL_IMPROVEMENT_0125.md](done/ISSUE_234_GRAPHQL_IMPROVEMENT_0125.md): 폐기된 계획이지만 REST API 전환 배경 참조

---

## 현재 구조

### GitHub Events API 응답 (공통 구조)

모든 이벤트는 다음 공통 구조를 가집니다:

```typescript
interface GithubEvent {
  id: string;                    // 이벤트 고유 ID
  type: string;                  // 이벤트 타입
  actor: { id: number; login: string };
  repo: { name: string };        // "owner/repo" 형식
  payload: object;               // 이벤트 타입별 상세 데이터
  created_at: string;            // ← GitHub 활동 발생 시간 (ISO 8601)
}
```

**예시:**
```json
{
  "id": "12345678901",
  "type": "PushEvent",
  "actor": { "id": 123, "login": "octocat" },
  "repo": { "id": 456, "name": "owner/repo" },
  "payload": { ... },
  "created_at": "2026-01-29T10:30:00Z"
}
```

### 현재 point_history 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | integer | PK |
| player_id | integer | FK → players.id |
| type | enum | 포인트 타입 |
| amount | integer | 포인트 량 |
| repository | varchar(100) | 레포지토리명 ("owner/repo") |
| description | varchar(200) | 활동 상세 (PR/이슈 제목, 커밋 메시지) |
| created_at | datetime | **포인트 기록 시점** (서버 시간, UTC) |

### 현재 데이터 흐름

```
GitHub Events API → github.poll-service.ts → processEvents()
    → commits/prOpens/prMerges/issues/reviews 배열 생성
    → pointService.addPoint() 호출
    → pointHistoryService.addHistoryWithManager() 호출
    → point_history 테이블에 저장 (created_at = 현재 시간)
```

**문제점**: `created_at`은 포인트 기록 시점이지, GitHub 활동 발생 시점이 아님

---

## 이벤트별 `created_at` 필드 매핑

> 출처: [ISSUE_240_GRAPHQL_TO_REST_0127.md](ISSUE_240_GRAPHQL_TO_REST_0127.md) 실제 API 응답 분석

### 공통 사항

**모든 이벤트에서 `event.created_at`이 활동 발생 시간입니다.**

```typescript
const activityAt = new Date(event.created_at);
// "2026-01-29T10:30:00Z" → Date object
```

### 1. PushEvent

| 항목 | 필드 경로 | 용도 |
|------|----------|------|
| repository | `event.repo.name` | point_history.repository |
| activityAt | **`event.created_at`** | point_history.activity_at |
| message | Compare API → `commits[].commit.message` | point_history.description |

**Compare API 커밋 시간 vs Event 시간:**

| 시간 유형 | 필드 | 사용 여부 |
|----------|------|----------|
| 푸시 이벤트 시간 | `event.created_at` | ✅ 사용 |
| 개별 커밋 작성 시간 | `commits[].commit.author.date` | ❌ 미사용 |

> **결정**: PushEvent 1개에 여러 커밋이 포함될 수 있으므로, 모든 커밋에 **푸시 이벤트 시점** (`event.created_at`)을 동일하게 적용

### 2. PullRequestEvent (opened/merged)

| 항목 | 필드 경로 | 용도 |
|------|----------|------|
| repository | `event.repo.name` | point_history.repository |
| activityAt | **`event.created_at`** | point_history.activity_at |
| title | PR API → `title` | point_history.description |
| action | `event.payload.action` | opened/merged 판별 |

**머지 판별 조건:**
```typescript
// GitHub REST Events API에서는 action === 'closed' && merged === true만 안전
action === 'closed' && pull_request?.merged === true
```

> **Note**: 240 문서 실험에서 `action === 'merged'`가 관찰되었으나, GitHub 공식 문서 기준 `closed + merged` 조건만 사용

### 3. IssuesEvent (opened)

| 항목 | 필드 경로 | 용도 |
|------|----------|------|
| repository | `event.repo.name` | point_history.repository |
| activityAt | **`event.created_at`** | point_history.activity_at |
| title | **`event.payload.issue.title`** | point_history.description |

> **특이사항**: 이슈 제목은 payload에 직접 포함되어 별도 API 호출 불필요

### 4. PullRequestReviewEvent (created)

| 항목 | 필드 경로 | 용도 |
|------|----------|------|
| repository | `event.repo.name` | point_history.repository |
| activityAt | **`event.created_at`** | point_history.activity_at |
| prTitle | PR API → `title` | point_history.description |
| prNumber | `event.payload.pull_request.number` | PR API 호출용 |

---

## API 검증 결과 (2026-01-29)

실제 `gh api /users/{username}/events/public` 호출로 필드 존재 확인:

### PushEvent ✅

```json
{
  "created_at": "2026-01-29T07:43:37Z",
  "repo": { "name": "boostcampwm2025/web19-estrogenquattro" },
  "payload": { "before": "2eadc84...", "head": "2ccc33d..." }
}
```

### IssuesEvent ✅

```json
{
  "created_at": "2026-01-29T07:24:43Z",
  "repo": { "name": "boostcampwm2025/web19-estrogenquattro" },
  "payload": {
    "action": "opened",
    "issue": {
      "title": "feat: GitHub 활동 시간 저장",
      "number": 321
    }
  }
}
```

### PullRequestEvent ✅

```json
{
  "created_at": "2026-01-29T06:28:31Z",
  "repo": { "name": "boostcampwm2025/web19-estrogenquattro" },
  "payload": {
    "action": "opened",
    "number": 316,
    "pull_request": { "merged": null }
  }
}
```

> **Note**: 환경에 따라 `pull_request` 객체가 없을 수 있음. 코드에서 `?.merged`로 안전 처리.

### PullRequestReviewEvent ✅

```json
{
  "created_at": "2026-01-29T03:42:19Z",
  "repo": { "name": "boostcampwm2025/web19-estrogenquattro" },
  "payload": {
    "action": "created",
    "pull_request": { "number": 313 },
    "review": { "state": "approved" }
  }
}
```

### 검증 요약

| 이벤트 타입 | `created_at` | `repo.name` | 상세 필드 |
|------------|-------------|-------------|----------|
| PushEvent | ✅ | ✅ | `payload.before`, `payload.head` |
| IssuesEvent | ✅ | ✅ | `payload.action`, `payload.issue.title` |
| PullRequestEvent | ✅ | ✅ | `payload.action`, `payload.number`, `payload.pull_request.merged` |
| PullRequestReviewEvent | ✅ | ✅ | `payload.action`, `payload.pull_request.number` |

---

## 변경 계획

### 1. point_history 테이블에 activity_at 컬럼 추가

| 컬럼 | 타입 | 설명 |
|------|------|------|
| activity_at | datetime | GitHub 활동 발생 시간 (nullable) |

- **nullable**: GitHub 활동이 아닌 경우 (TASK_COMPLETED, FOCUSED) null

### 2. 데이터 흐름 변경

```
GitHub Events API → github.poll-service.ts → processEvents()
    → 각 이벤트에서 created_at 추출하여 배열에 포함
    → pointService.addPoint() 호출 시 activityAt 전달
    → pointHistoryService.addHistoryWithManager() 호출 시 activityAt 전달
    → point_history 테이블에 저장 (activity_at = GitHub 이벤트 시간)
```

### 3. activity_at 사용처

| 용도 | 설명 | 우선순위 |
|------|------|----------|
| 포인트 히스토리 정렬 | `activity_at` 기준 정렬 (실제 활동 시간순) | 향후 구현 |
| 활동 타임라인 표시 | 프로필 페이지에서 활동 시간 표시 | 향후 구현 |
| 일별 집계 검증 | `created_at`과 `activity_at` 차이로 폴링 지연 분석 | 디버깅용 |

> **Note**: 이번 이슈에서는 저장만 구현. 조회/표시는 별도 이슈로 분리.
> 기존 `created_at` 기반 정렬/조회는 그대로 유지 (하위 호환성).

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/pointhistory/entities/point-history.entity.ts` | `activityAt` 컬럼 추가 |
| `backend/src/database/migrations/XXXXXXXXX-AddActivityAt.ts` | 마이그레이션 파일 생성 |
| `backend/src/pointhistory/point-history.service.ts` | `addHistoryWithManager()` 파라미터 추가 |
| `backend/src/point/point.service.ts` | `addPoint()` 파라미터 추가 |
| `backend/src/github/github.poll-service.ts` | 이벤트 처리 시 `created_at` 추출 및 전달 |
| `docs/guides/ERD.md` | point_history 테이블 문서 업데이트 |

---

## 구현 상세

### Step 1: Entity 수정

```typescript
// backend/src/pointhistory/entities/point-history.entity.ts
@Column({ name: 'activity_at', type: 'datetime', nullable: true })
activityAt: Date | null;
```

### Step 2: 마이그레이션 생성

**자동 생성 마이그레이션 사용:**

```bash
cd backend && pnpm migration:generate src/database/migrations/AddActivityAt
```

TypeORM이 Entity 변경을 감지하여 up/down 모두 자동 생성합니다.

### Step 3: Service 메서드 시그니처 변경

```typescript
// point-history.service.ts
async addHistoryWithManager(
  manager: EntityManager,
  playerId: number,
  type: PointType,
  amount: number,
  repository?: string | null,
  description?: string | null,
  activityAt?: Date | null,  // 추가
): Promise<PointHistory>

// point.service.ts
async addPoint(
  playerId: number,
  activityType: PointType,
  count: number,
  repository?: string | null,
  description?: string | null,
  activityAt?: Date | null,  // 추가
): Promise<DailyPoint>
```

### Step 4: processEvents() 반환 타입 변경

```typescript
// github.poll-service.ts
interface CommitDetail {
  repository: string;
  message: string;
  activityAt: Date;  // 추가
}

interface PrDetail {
  repository: string;
  title: string;
  activityAt: Date;  // 추가
}

interface IssueDetail {
  repository: string;
  title: string;
  activityAt: Date;  // 추가
}

interface ReviewDetail {
  repository: string;
  prTitle: string;
  activityAt: Date;  // 추가
}
```

### Step 5: 이벤트 처리 시 created_at 추출

```typescript
// github.poll-service.ts processEvents() 내부
for (const event of events) {
  const repoName = event.repo.name;
  const activityAt = new Date(event.created_at);  // 모든 이벤트 공통

  switch (event.type) {
    case 'PushEvent': {
      const pushPayload = event.payload as PushEventPayload;
      const commitDetails = await this.getCommitDetails(...);
      for (const msg of commitDetails.messages) {
        commits.push({ repository: repoName, message: msg, activityAt });
      }
      break;
    }

    case 'PullRequestEvent': {
      const prPayload = event.payload as PullRequestEventPayload;
      const prTitle = await this.getPrTitle(repoName, prPayload.number, accessToken);
      if (prPayload.action === 'opened') {
        prOpens.push({ repository: repoName, title: prTitle, activityAt });
      } else if (prPayload.action === 'closed' && prPayload.pull_request?.merged === true) {
        prMerges.push({ repository: repoName, title: prTitle, activityAt });
      }
      break;
    }

    case 'IssuesEvent': {
      const issuePayload = event.payload as IssuesEventPayload;
      if (issuePayload.action === 'opened') {
        issues.push({
          repository: repoName,
          title: issuePayload.issue.title,  // payload에서 직접 추출
          activityAt,
        });
      }
      break;
    }

    case 'PullRequestReviewEvent': {
      const reviewPayload = event.payload as PullRequestReviewEventPayload;
      if (reviewPayload.action === 'created') {
        const prTitle = await this.getPrTitle(repoName, reviewPayload.pull_request.number, accessToken);
        reviews.push({ repository: repoName, prTitle, activityAt });
      }
      break;
    }
  }
}
```

### Step 6: addPoint 호출 시 activityAt 전달

```typescript
// github.poll-service.ts
for (const commit of details.commits) {
  await this.pointService.addPoint(
    playerId,
    PointType.COMMITTED,
    1,
    commit.repository,
    commit.message,
    commit.activityAt,  // 추가
  );
}
```

---

## 주의사항

### 1. PushEvent의 여러 커밋 처리

PushEvent 1개에 여러 커밋이 포함될 수 있습니다. 모든 커밋에 동일한 `activityAt` 적용:

```typescript
// PushEvent.created_at을 모든 커밋에 동일 적용
const activityAt = new Date(event.created_at);
for (const msg of commitDetails.messages) {
  commits.push({ repository: repoName, message: msg, activityAt });
}
```

### 2. 기존 호출부 영향 없음 확인

`activityAt` 파라미터는 **optional**이므로 기존 호출부에 영향 없음:

```typescript
// 기존 호출 (TASK_COMPLETED, FOCUSED) - 변경 불필요
await this.pointService.addPoint(playerId, PointType.TASK_COMPLETED, 1, null, taskDescription);
// activityAt 미전달 → null로 저장됨
```

### 3. 타임존 저장 기준

**저장: UTC 기준** (GitHub API 응답 그대로)

```typescript
const activityAt = new Date("2026-01-29T10:30:00Z");  // UTC 그대로 저장
// SQLite에 "2026-01-29 10:30:00" 형식으로 저장됨 (UTC)
```

**표시: 클라이언트에서 로컬 변환**

```typescript
// 프론트엔드에서 로컬 시간으로 표시
new Date(activityAt).toLocaleString();  // 사용자 타임존으로 변환
```

> **기준**: `created_at`과 동일하게 UTC 저장, 표시 시 클라이언트 변환

---

## 테스트 계획

1. **단위 테스트**
   - `addHistoryWithManager()` 호출 시 `activityAt`이 저장되는지 확인
   - `activityAt`이 null일 때 (TASK_COMPLETED, FOCUSED) 정상 동작 확인

2. **통합 테스트**
   - GitHub 이벤트 폴링 후 `point_history.activity_at`에 올바른 값 저장 확인
   - 기존 기능 (TASK_COMPLETED, FOCUSED 포인트) 영향 없음 확인

3. **수동 테스트**
   - 실제 GitHub 커밋 후 폴링 → DB에서 `activity_at` 값 확인
   - `SELECT * FROM point_history ORDER BY id DESC LIMIT 10;`

---

## 예상 시나리오

| 포인트 타입 | activity_at 값 |
|------------|----------------|
| COMMITTED | GitHub PushEvent.created_at |
| PR_OPEN | GitHub PullRequestEvent.created_at |
| PR_MERGED | GitHub PullRequestEvent.created_at |
| PR_REVIEWED | GitHub PullRequestReviewEvent.created_at |
| ISSUE_OPEN | GitHub IssuesEvent.created_at |
| TASK_COMPLETED | null |
| FOCUSED | null |

---

## 체크리스트

- [ ] Entity에 `activityAt` 컬럼 추가
- [ ] 마이그레이션 파일 생성 (`pnpm migration:generate`) 및 실행
- [ ] `addHistoryWithManager()` 파라미터 추가
- [ ] `addPoint()` 파라미터 추가
- [ ] `processEvents()` 반환 타입에 `activityAt` 추가
- [ ] 각 이벤트 처리 시 `created_at` 추출
- [ ] `addPoint()` 호출 시 `activityAt` 전달
- [ ] 기존 호출 (TASK_COMPLETED, FOCUSED) 영향 없음 확인
- [ ] ERD 문서 업데이트 ✅ (repository 컬럼 반영됨)
- [ ] CI 통과 확인

### Scope Out (별도 이슈)

- [ ] point_history 조회 시 `activity_at` 기준 정렬
- [ ] 프론트엔드 활동 타임라인에 `activity_at` 표시
- [ ] 기존 레코드 backfill (null 유지 허용)

---

## Q&A (리뷰 피드백 반영)

| 질문 | 답변 |
|------|------|
| 실제 폴링 데이터 소스는? | **REST Events API** (120초 간격). CLAUDE.md 수정 완료. |
| activity_at 사용처는? | 이번 이슈는 **저장만** 구현. 정렬/표시는 별도 이슈. |
| 기존 레코드 backfill 필요? | **null 유지 허용**. GitHub 이벤트 시간은 이미 지나감. |
| PushEvent "푸시 시점" 일괄 적용 적절? | **적절**. 개별 커밋 시간보다 "언제 공유되었나"가 게임 목적에 부합. |
| 타임존 저장 기준은? | **UTC 저장**, 표시 시 클라이언트에서 로컬 변환. |
