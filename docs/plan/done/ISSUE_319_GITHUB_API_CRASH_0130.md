# Issue #319: GitHub API 네트워크 오류 시 서버 크래시

## 이슈 요약

GitHub API 네트워크 오류 발생 시 서버가 크래시되는 문제

## 에러 로그

```
[EstrogenQuattro] 490848 2026-01-29 06:59:38   ERROR [GithubPollService] [davidpro08] GitHub API network error: fetch failed - { stack: [ null ] }
```

## 코드 분석

### 현재 에러 핸들링 구조

```
handlePoll(username)
  └── pollGithubEvents(username)           ← try-catch 있음 (line 308-315)
        └── processEvents(events, schedule)  ← try-catch 없음
              ├── getCommitDetails()         ← try-catch 있음 (line 695-698)
              └── getPrTitle()               ← try-catch 있음 (line 730-732)
```

### 문제 1: pollGithubEvents 네트워크 에러

```typescript
// line 307-315
let res: Response;
try {
  res = await fetch(url, { headers });
} catch (error) {
  this.logger.error(
    `[${username}] GitHub API network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
  );
  return { status: 'error' };  // ✅ 정상 처리됨
}
```

**분석:** 메인 fetch는 정상적으로 catch되어 `{ status: 'error' }`를 반환

### 문제 2: processEvents 내부 에러

```typescript
// line 531-658
private async processEvents(
  events: GithubEvent[],
  schedule: PollingSchedule,
): Promise<...> {
  // ❌ try-catch 없음
  for (const event of events) {
    switch (event.type) {
      case 'PushEvent': {
        // getCommitDetails 호출 - 내부 try-catch 있음
        const commitDetails = await this.getCommitDetails(...);
        // ❌ 하지만 for 루프에서 다른 예외 발생 시 전파됨
        break;
      }
      // ...
    }
  }
}
```

**분석:** `processEvents` 자체에 try-catch가 없어서 예상치 못한 예외 발생 시 상위로 전파

### 문제 3: pollGithubEvents에서 processEvents 호출

```typescript
// line 402
const details = await this.processEvents(newEvents, schedule);
// ❌ processEvents에서 예외 발생 시 pollGithubEvents 전체 실패
```

### 문제 4: handlePoll에서 unhandled rejection 가능성

```typescript
// line 228-270
private async handlePoll(username: string) {
  const result = await this.pollGithubEvents(username);
  // ❌ pollGithubEvents가 예외를 throw하면 handlePoll도 실패
  // ❌ handlePoll은 void로 호출되어 unhandled rejection 발생 가능
}
```

```typescript
// line 171-173
const timeout = setTimeout(() => {
  void this.handlePoll(username);  // ❌ void 사용으로 rejection 무시됨
}, 1000);
```

---

## 잠재적 크래시 시나리오

1. **JSON 파싱 실패**: `res.json()` 호출 시 유효하지 않은 JSON
2. **타입 가드 우회**: `isGithubEventArray` 통과 후 런타임 타입 불일치
3. **processEvents 내 예외**: 이벤트 처리 중 예상치 못한 에러
4. **DB 작업 실패**: `incrementActivity`, `addPoint` 에러

---

## 해결 방안

### 1. processEvents에 try-catch 추가

```typescript
private async processEvents(
  events: GithubEvent[],
  schedule: PollingSchedule,
): Promise<...> {
  const commits = [];
  // ...

  for (const event of events) {
    try {
      // 기존 switch 로직
    } catch (error) {
      this.logger.error(
        `[${schedule.username}] Failed to process event ${event.id}: ${error}`,
      );
      // 개별 이벤트 실패 시 스킵하고 계속 진행
      continue;
    }
  }

  return { commits, prOpens, prMerges, issues, reviews };
}
```

### 2. pollGithubEvents에서 processEvents 호출 보호

```typescript
// line 402 수정
let details;
try {
  details = await this.processEvents(newEvents, schedule);
} catch (error) {
  this.logger.error(`[${username}] Failed to process events: ${error}`);
  return { status: 'error' };
}
```

### 3. DB 작업에 try-catch 추가

```typescript
// 커밋 처리 (line 419-434)
if (details.commits.length > 0) {
  try {
    await this.githubService.incrementActivity(...);
    for (const commit of details.commits) {
      await this.pointService.addPoint(...);
    }
  } catch (error) {
    this.logger.error(`[${username}] Failed to save commits: ${error}`);
  }
}
```

### 4. handlePoll 전체 try-catch

```typescript
private async handlePoll(username: string) {
  try {
    const schedule = this.pollingSchedules.get(username);
    if (!schedule) return;

    const result = await this.pollGithubEvents(username);
    // ... 기존 로직
  } catch (error) {
    this.logger.error(`[${username}] Unexpected error in handlePoll: ${error}`);
    // 에러 발생해도 다음 폴링 스케줄
    this.scheduleNextPoll(username, POLL_INTERVAL);
  }
}
```

---

## 구현 우선순위

1. **[높음]** `handlePoll` 전체 try-catch 추가 - 모든 에러 캡처
2. **[높음]** `processEvents` try-catch 추가 - 개별 이벤트 실패 격리
3. **[중간]** DB 작업 try-catch - 데이터 저장 실패 격리
4. **[낮음]** JSON 파싱 에러 핸들링 강화

---

## 테스트 계획

1. **네트워크 에러 시뮬레이션**
   - GitHub API 호출 실패 시 서버 안정성 확인
   - 다음 폴링이 정상 스케줄되는지 확인

2. **잘못된 응답 처리**
   - 유효하지 않은 JSON 응답
   - 예상치 못한 이벤트 타입

3. **DB 장애 시뮬레이션**
   - `incrementActivity` 실패 시 동작
   - 트랜잭션 롤백 확인

---

## 관련 파일

- `backend/src/github/github.poll-service.ts`

## 관련 문서

- `docs/api/GITHUB_POLLING.md`
