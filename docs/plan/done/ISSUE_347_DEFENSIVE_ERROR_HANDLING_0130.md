# Issue #347: GitHub 폴링 서비스 방어적 에러 핸들링 추가

## 이슈 링크

https://github.com/boostcampwm2025/web19-estrogenquattro/issues/347

## 브랜치

`fix/#347-github-poll-defensive-error-handling`

## 배경

Issue #319 분석 결과, `GithubPollService`에서 일부 경로에 try-catch가 없어 예외 발생 시 unhandled rejection 가능성 존재. 네트워크 에러 자체는 catch되지만, 이후 처리 과정에서 보호되지 않는 부분이 있음.

## 현재 상태

| 위치 | 함수/코드 | try-catch | 위험도 |
|------|-----------|-----------|--------|
| `pollGithubEvents` | `fetch()` 호출 | ✅ 있음 | - |
| `pollGithubEvents` | `res.json()` 파싱 | ❌ 없음 | 중 |
| `handlePoll` | 전체 흐름 | ❌ 없음 | 높음 |
| `processEvents` | 개별 이벤트 처리 | ❌ 없음 | 중 |
| `pollGithubEvents` | DB 작업 (5개 경로) | ❌ 없음 | 중 |

## 작업 내용

### 1. `handlePoll` 전체 try-catch (우선순위: 높음)

최상위 레벨에서 모든 예외를 캡처하여 폴링이 중단되지 않도록 보호

> **주의:** 기존 stop/backoff 규칙 유지
> - 401 토큰 만료 시 `stopPolling()` 호출 후 재스케줄링 안 함
> - 403/429 rate limit 시 `POLL_INTERVAL_BACKOFF` (10분) 사용
> - catch 블록에서 스케줄 존재 여부 확인 후 재스케줄링

```typescript
private async handlePoll(username: string) {
  try {
    // 기존 로직
  } catch (error) {
    this.logger.error(
      `[${username}] Unexpected error in handlePoll: ${error instanceof Error ? error.message : error}`,
    );
    // 이미 중지된 경우(401 등) 재스케줄링하지 않음
    if (this.pollingSchedules.has(username)) {
      this.scheduleNextPoll(username, POLL_INTERVAL);
    }
  }
}
```

### 2. `res.json()` 파싱 보호 (우선순위: 중)

GitHub API가 비정상 응답(HTML 에러 페이지 등) 반환 시 대응

```typescript
let eventsData: unknown;
try {
  eventsData = await res.json();
} catch (error) {
  this.logger.error(
    `[${username}] Failed to parse JSON response (status: ${res.status}, content-type: ${res.headers.get('content-type')})`,
  );
  return { status: 'error' };
}
```

### 3. `processEvents` 개별 이벤트 보호 (우선순위: 중)

하나의 이벤트 처리 실패 시 나머지 이벤트는 계속 처리

> **주의:** `event.id` 접근 시 null/undefined 방어 필요. malformed 이벤트에서 catch 내 에러 발생 방지.

```typescript
for (const event of events) {
  try {
    // 기존 switch 로직
  } catch (error) {
    this.logger.error(
      `[${schedule.username}] Failed to process event ${event?.id ?? 'unknown'}: ${error}`,
    );
    continue;
  }
}
```

### 4. DB 작업 보호 (우선순위: 중)

DB 저장 실패해도 폴링은 계속 진행. **5개 경로 모두 동일한 패턴 적용:**

| 경로 | 함수 위치 (`pollGithubEvents` 내) |
|------|----------------------------------|
| 커밋 | `details.commits` 처리 |
| PR 생성 | `details.prOpens` 처리 |
| PR 머지 | `details.prMerges` 처리 |
| 이슈 생성 | `details.issues` 처리 |
| PR 리뷰 | `details.reviews` 처리 |

```typescript
// 커밋 예시 (다른 4개 경로도 동일한 패턴 적용)
if (details.commits.length > 0) {
  try {
    await this.githubService.incrementActivity(...);
    for (const commit of details.commits) {
      await this.pointService.addPoint(...);
    }
  } catch (error) {
    this.logger.error(`[${username}] Failed to save commit data: ${error}`);
  }
}

// PR 생성
if (details.prOpens.length > 0) {
  try {
    await this.githubService.incrementActivity(...);
    for (const pr of details.prOpens) {
      await this.pointService.addPoint(...);
    }
  } catch (error) {
    this.logger.error(`[${username}] Failed to save PR open data: ${error}`);
  }
}

// PR 머지, 이슈 생성, PR 리뷰도 동일한 패턴으로 래핑
```

## 수정 대상 파일

- `backend/src/github/github.poll-service.ts`

## 테스트 계획

1. 기존 동작 유지 확인
2. lint/format/build/test 통과 확인

## 관련 문서

- `docs/api/GITHUB_POLLING.md` - 현재 구현과 일치 (REST + 120초)
- `docs/plan/ISSUE_319_GITHUB_API_CRASH_0130.md`
