# Issue #198: 기여도 목록 0 표시 버그 분석

> 2026-01-24 작성

## 문서 목표

1. **버그 원인 파악** - 기여도 목록이 0으로 표시되는 원인 분석
2. **GitHub 폴링 로직 점검** - 폴링 시스템 전체 동작 검증 및 잠재적 문제 식별
3. **디버깅 가이드 제공** - 재현 시나리오 및 로그 추가 위치 정리

---

## 참조한 문서

- `docs/api/GITHUB_POLLING.md`: GitHub 폴링 시스템 전체 흐름
- `docs/api/SOCKET_EVENTS.md`: `github_event`, `github_state` 이벤트 명세

## 이슈 요약

프로그레스바 하단의 기여도 목록에서 기여도가 0으로 표시되는 현상

## 현재 구조 분석

### 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GitHub Polling Flow                                  │
└─────────────────────────────────────────────────────────────────────────────┘

1. 사용자 접속 (joining)
       │
       ▼
2. GithubPollService.subscribeGithubEvent()
   - 1초 후 첫 폴링 시작
   - 기준점(baseline) 설정 (isFirstPoll: true)
       │
       ▼
3. pollGithubEvents() - GraphQL API 호출
   - contributionsCollection 조회
   - 첫 폴링: 기준점 설정만, 이벤트 전송 안 함
       │
       ▼
4. 이후 폴링 (30초 간격)
   - 새 기여 수 = 현재값 - 기준점
   - newCommitCount, newPRCount > 0이면
       │
       ▼
5. GithubGateway.castGithubEventToRoom()
   - updateRoomState(): progress, contributions 업데이트
   - emit('github_event', {...})
       │
       ▼
6. SocketManager (Frontend)
   - github_event 수신
   - addContribution(username, totalCount)
       │
       ▼
7. ContributionList UI 업데이트
```

### 관련 코드 포인트

| 위치 | 파일 | 역할 |
|------|------|------|
| 백엔드 | `github.poll-service.ts` | GitHub API 폴링, 기준점 관리 |
| 백엔드 | `github.gateway.ts` | roomStates 관리, github_event 브로드캐스트 |
| 백엔드 | `player.gateway.ts:260-261` | 입장 시 github_state 전송 |
| 프론트엔드 | `SocketManager.ts:208-223` | github_state/github_event 핸들링 |
| 프론트엔드 | `createContributionList.ts` | 기여도 목록 렌더링 |

---

## 잠재적 버그 원인 (가설)

### 가설 1: roomStates 초기화 문제

**현상:** 서버 재시작 또는 새 방 생성 시 `roomStates`가 비어있음

**코드 분석:**
```typescript
// github.gateway.ts
private roomStates = new Map<string, RoomGithubState>();

public getRoomState(roomId: string): RoomGithubState {
  // 방이 없으면 빈 상태 반환
  return this.roomStates.get(roomId) || { progress: 0, contributions: {} };
}
```

**영향:**
- 입장 시 `github_state`로 `{ progress: 0, contributions: {} }` 전송
- 기존 기여 기록이 없으면 0으로 표시

**확인 방법:**
1. 서버 재시작 후 접속
2. `github_state` 이벤트 데이터 확인
3. `contributions` 객체가 비어있는지 확인

---

### 가설 2: 기준점(Baseline) 문제

**현상:** 첫 폴링 후 기여가 발생하지 않으면 0 유지

**코드 분석:**
```typescript
// github.poll-service.ts
// 첫 폴링이면 기준점만 설정하고 알림 안 보냄
if (isFirstPoll) {
  baseline.lastCommitCount = currentCommitCount;
  // ...
  return { status: 'no_changes' };  // github_event 전송 안 함
}
```

**영향:**
- 기준점 설정 시점의 기여는 반영 안 됨 (의도된 동작)
- 이후 새 기여가 없으면 계속 0으로 표시

**확인 방법:**
1. 접속 후 GitHub 활동 없이 대기
2. 기여도 목록이 0인 것이 정상인지 확인
3. 새 커밋/PR 후 기여도 증가 확인

---

### 가설 3: 이벤트 수신 타이밍 문제

**현상:** `github_state`보다 UI 초기화가 먼저 발생

**코드 분석:**
```typescript
// SocketManager.ts
socket.on("github_state", (data: GithubStateData) => {
  this.progressBarController?.setProgress(data.progress);
  this.contributionController?.setContributions(data.contributions);
});
```

**영향:**
- `contributionController`가 아직 설정되지 않은 상태에서 이벤트 수신 시 무시됨

**확인 방법:**
1. `github_state` 이벤트 수신 시 `contributionController` 존재 여부 로깅
2. `setContributionController()` 호출 시점 확인

---

### 가설 4: contributions 객체 키 불일치

**현상:** `username` 값이 예상과 다름

**코드 분석:**
```typescript
// github.gateway.ts
state.contributions[event.username] =
  (state.contributions[event.username] || 0) + totalCount;
```

**영향:**
- GitHub username과 다른 값이 들어가면 조회 실패

**확인 방법:**
1. `github_event` 데이터의 `username` 값 확인
2. OAuth 로그인 시 저장된 `username`과 비교

---

### 가설 5: 프로그레스바 100% 리셋 시 기여도 미리셋

**현상:** 맵 전환 시 프로그레스바는 리셋되지만 기여도는 유지

**코드 분석:**
```typescript
// github.gateway.ts
state.progress = (state.progress + progressIncrement) % 100;
// contributions는 리셋하지 않음
```

**영향:**
- 맵 전환 후 기여도가 이전 맵의 값을 유지
- 의도된 동작일 수 있음 (확인 필요)

---

## GitHub 폴링 로직 점검

### 폴링 라이프사이클

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Polling Lifecycle                                       │
└─────────────────────────────────────────────────────────────────────────────┘

[사용자 접속]
     │
     ▼
subscribeGithubEvent()
     │
     ├── 기존 폴링 있음? ──Yes──> clientIds에 추가만 (중복 폴링 방지)
     │         │
     │        No
     │         │
     │         ▼
     │   userBaselines 확인
     │         │
     │         ├── 있음 ──> 기준점 복원 (새로고침 대응)
     │         │
     │         └── 없음 ──> 새 기준점 생성 (isFirstPoll: true)
     │                        │
     │                        ▼
     │                  1초 후 첫 폴링
     │                        │
     └────────────────────────┘
                              │
                              ▼
                       handlePoll()
                              │
                              ▼
                    pollGithubEvents()
                              │
                   ┌──────────┴──────────┐
                   │                     │
              isFirstPoll?              이후 폴링
                   │                     │
                  Yes                    │
                   │                     ▼
                   ▼              새 기여 계산
            기준점 설정만         (현재값 - 기준점)
            이벤트 전송 X               │
                   │                    │
                   │              ┌─────┴─────┐
                   │              │           │
                   │           > 0          = 0
                   │              │           │
                   │              ▼           ▼
                   │       castGithubEvent  no_changes
                   │              │           │
                   └──────────────┴───────────┘
                              │
                              ▼
                    30초 후 다음 폴링
```

### 점검 항목: 폴링 시작/종료

| # | 점검 항목 | 정상 동작 | 잠재적 문제 |
|---|----------|----------|-------------|
| 1 | 폴링 시작 시점 | joining 이벤트 처리 후 1초 뒤 | 타이밍 이슈로 누락 가능 |
| 2 | 중복 폴링 방지 | 같은 username이면 clientIds에만 추가 | username 불일치 시 중복 폴링 |
| 3 | 폴링 종료 조건 | 모든 clientIds 제거 시 | 클라이언트 정리 누락 시 좀비 폴링 |
| 4 | 기준점 복원 | 새로고침 시 기존 기준점 유지 | 오래된 기준점으로 잘못된 계산 |

### 점검 항목: GraphQL API 호출

| # | 점검 항목 | 정상 동작 | 잠재적 문제 |
|---|----------|----------|-------------|
| 1 | API 응답 | HTTP 200 + data.user.contributionsCollection | null/undefined 반환 시 처리 |
| 2 | Rate Limit | 429 시 120초 백오프 | 지속적 429 시 폴링 실패 누적 |
| 3 | 네트워크 에러 | catch 후 30초 뒤 재시도 | 에러 로그만 남기고 조용히 실패 |
| 4 | 토큰 만료 | 401 처리 | 만료 토큰으로 계속 폴링 시도 |

### 점검 항목: 기여 계산

| # | 점검 항목 | 정상 동작 | 잠재적 문제 |
|---|----------|----------|-------------|
| 1 | 기준점 설정 | 첫 폴링 시 현재 값으로 설정 | API 에러 시 0으로 설정될 가능성 |
| 2 | 새 기여 계산 | `Math.max(0, 현재 - 기준점)` | 기준점 > 현재 시 항상 0 |
| 3 | 기준점 갱신 | 매 폴링마다 현재 값으로 갱신 | 갱신 누락 시 중복 카운트 |
| 4 | DB 저장 | 새 기여 수 > 0 시 incrementActivity | 트랜잭션 실패 시 불일치 |

### 점검 항목: 이벤트 브로드캐스트

| # | 점검 항목 | 정상 동작 | 잠재적 문제 |
|---|----------|----------|-------------|
| 1 | roomState 업데이트 | contributions[username] 누적 | username 키 불일치 |
| 2 | github_event emit | roomId로 브로드캐스트 | roomId 변경 시 다른 방으로 전송 |
| 3 | progress 계산 | 커밋*2 + PR*5, 100에서 리셋 | 리셋 시 contributions 미리셋 |
| 4 | github_state 전송 | 입장 시 현재 roomState 전송 | 빈 상태 전송 가능 |

### 엣지 케이스 점검

| 시나리오 | 예상 동작 | 확인 필요 |
|----------|----------|----------|
| 사용자 A 입장 → 커밋 → 사용자 B 입장 | B가 A의 기여도 볼 수 있음 | github_state 전송 확인 |
| 같은 사용자 2개 탭 오픈 | 폴링 1개만, 이벤트 양쪽 수신 | clientIds 관리 확인 |
| 폴링 중 방 이동 | 새 방에서 폴링 계속? 리셋? | roomId 업데이트 로직 확인 |
| GitHub 점검 시간 (API 불가) | 폴링 에러 → 30초 후 재시도 | 장시간 에러 시 복구 확인 |
| 토큰 만료 후 재로그인 | 새 토큰으로 폴링 재시작 | 기존 폴링 정리 확인 |

---

## GraphQL 쿼리 로직 점검

### 현재 사용 쿼리

```graphql
query($username: String!) {
  user(login: $username) {
    contributionsCollection {
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
    }
  }
}
```

### 쿼리 분석

| 필드 | 설명 | 용도 |
|------|------|------|
| `totalCommitContributions` | 총 커밋 수 (1년 기준) | 프로그레스바 +2/커밋 |
| `totalIssueContributions` | 총 이슈 생성 수 | DB 저장만 (프로그레스바 미반영) |
| `totalPullRequestContributions` | 총 PR 생성 수 | 프로그레스바 +5/PR |
| `totalPullRequestReviewContributions` | 총 PR 리뷰 수 | DB 저장만 (프로그레스바 미반영) |

### 쿼리 제한 사항

| 항목 | 현재 상태 | 영향 |
|------|----------|------|
| 기간 범위 | 기본값 (최근 1년) | 1년 이상 된 기여는 미반영 |
| from/to 파라미터 | 미사용 | 특정 기간 필터링 불가 |
| 프라이빗 레포 | 토큰 권한에 따라 다름 | 권한 없으면 미포함 가능 |
| organizationContributions | 미조회 | 조직 기여 별도 집계 불가 |

### 응답 파싱 검증

```typescript
// 현재 파싱 로직
const contributionsCollection = json.data?.user?.contributionsCollection;
if (!contributionsCollection) {
  return { status: 'no_changes' };  // ⚠️ 데이터 없으면 조용히 무시
}

const currentCommitCount = contributionsCollection.totalCommitContributions ?? 0;
const currentPRCount = contributionsCollection.totalPullRequestContributions ?? 0;
```

### 점검 항목: 쿼리 정확성

| # | 점검 항목 | 확인 방법 | 예상 결과 |
|---|----------|----------|----------|
| 1 | username 변수 전달 | 로그에서 username 확인 | OAuth 로그인 username과 일치 |
| 2 | contributionsCollection 존재 | API 응답 로깅 | null이 아닌 객체 반환 |
| 3 | 커밋 수 정확성 | GitHub 프로필 페이지와 비교 | 동일한 값 |
| 4 | PR 수 정확성 | GitHub 프로필 페이지와 비교 | 동일한 값 |

### 점검 항목: 에러 응답 처리

| # | 에러 유형 | 현재 처리 | 개선 가능 |
|---|----------|----------|----------|
| 1 | `json.errors` 존재 | 로그 출력 후 `{ status: 'error' }` | 에러 종류별 분기 처리 |
| 2 | `user: null` | `no_changes` 반환 | 사용자 미존재 알림 |
| 3 | 필드 undefined | `?? 0`으로 기본값 | 정상 동작 |
| 4 | 토큰 권한 부족 | `errors` 배열에 포함 | 권한 에러 별도 처리 |

### GraphQL 테스트 방법

```bash
# 토큰으로 직접 테스트
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"query": "query($username: String!) { user(login: $username) { contributionsCollection { totalCommitContributions totalPullRequestContributions } } }", "variables": {"username": "<USERNAME>"}}' \
     https://api.github.com/graphql
```

### 예상 응답 형식

```json
{
  "data": {
    "user": {
      "contributionsCollection": {
        "totalCommitContributions": 42,
        "totalIssueContributions": 5,
        "totalPullRequestContributions": 10,
        "totalPullRequestReviewContributions": 8
      }
    }
  }
}
```

### 잠재적 쿼리 문제

| 문제 | 원인 | 해결 방안 |
|------|------|----------|
| 기여 0 반환 | 프라이빗 레포 권한 없음 | OAuth scope 확인 (`repo` 필요) |
| user null | username 오타/변경 | OAuth에서 가져온 username 검증 |
| 오래된 데이터 | GitHub API 캐시 | `Cache-Control: no-cache` 헤더 추가 |
| 조직 기여 미포함 | 기본 쿼리 한계 | `organizationContributions` 별도 조회 |

---

## 점검 체크리스트

### 백엔드 점검

| # | 항목 | 확인 방법 | 예상 결과 |
|---|------|----------|----------|
| 1 | GitHub API 응답 | 서버 로그 `[GitHub Poll]` 확인 | HTTP 200, contributions 데이터 존재 |
| 2 | 기준점 설정 | 로그 `First poll - baseline set` 확인 | 첫 폴링 시 1회만 출력 |
| 3 | 새 기여 감지 | 로그 `New contributions detected!` 확인 | 커밋/PR 후 출력 |
| 4 | roomState 업데이트 | `github_event` emit 전 state 로깅 추가 | contributions에 username 존재 |
| 5 | github_state 전송 | 입장 시 전송 데이터 로깅 | contributions 객체 확인 |

### 프론트엔드 점검

| # | 항목 | 확인 방법 | 예상 결과 |
|---|------|----------|----------|
| 1 | github_state 수신 | DevTools > Network > WS 확인 | contributions 객체 존재 |
| 2 | github_event 수신 | DevTools > Network > WS 확인 | pushCount/pullRequestCount > 0 |
| 3 | Controller 초기화 | `setContributionController()` 호출 로깅 | github_state 수신 전 호출 |
| 4 | addContribution 호출 | `createContributionList.ts`에 로깅 추가 | 정상적인 username, count 값 |
| 5 | UI 렌더링 | DOM 직접 확인 | 텍스트 노드에 올바른 값 |

---

## 재현 시나리오

### 시나리오 A: 신규 접속 후 GitHub 활동 없음

```
1. 로그인 후 게임 입장
2. GitHub 활동 없이 30초 이상 대기
3. 기여도 목록 확인
   - 예상: 빈 목록 또는 "기여 없음" 표시
   - 버그: "username:0" 형태로 표시
```

### 시나리오 B: 기존 방에 신규 접속

```
1. 사용자 A가 먼저 입장, 커밋 발생
2. 사용자 B가 나중에 입장
3. 사용자 B의 기여도 목록 확인
   - 예상: 사용자 A의 기여도 표시
   - 버그: 0으로 표시
```

### 시나리오 C: 서버 재시작 후

```
1. 서버 재시작
2. 기존 사용자 재접속
3. 기여도 목록 확인
   - 예상: 0부터 시작 (roomState 초기화)
   - 버그 아님: 의도된 동작 (메모리 기반)
```

---

## 디버깅 로그 추가 위치

### 백엔드

```typescript
// github.gateway.ts - castGithubEventToRoom()
this.logger.debug(`[Room ${roomId}] Before update:`, state);
this.updateRoomState(roomId, githubEvent);
this.logger.debug(`[Room ${roomId}] After update:`, this.roomStates.get(roomId));

// player.gateway.ts - handleJoin()
const roomState = this.githubGateway.getRoomState(roomId);
this.logger.log(`[${username}] Sending github_state:`, roomState);
client.emit('github_state', roomState);
```

### 프론트엔드

```typescript
// SocketManager.ts
socket.on("github_state", (data: GithubStateData) => {
  console.log("[SocketManager] github_state received:", data);
  console.log("[SocketManager] contributionController exists:", !!this.contributionController);
  // ...
});

socket.on("github_event", (data: GithubEventData) => {
  console.log("[SocketManager] github_event received:", data);
  // ...
});

// createContributionList.ts
const addContribution = (username: string, count: number) => {
  console.log(`[ContributionList] addContribution: ${username}, ${count}`);
  // ...
};
```

---

## 해결 방안 (가설별)

### 가설 1 해결: roomStates 영속화

**Issue #214와 연관** - 서버 재시작 시 상태 초기화 문제

- 단기: 문서화 (서버 재시작 시 리셋됨을 명시)
- 장기: Redis 또는 DB에 roomState 영속화

### 가설 2 해결: 기준점 동작 문서화

- 의도된 동작이라면 사용자에게 안내
- "GitHub 활동을 시작하세요!" 등의 안내 메시지 표시

### 가설 3 해결: 이벤트 버퍼링

```typescript
// contributionController 설정 전 이벤트 임시 저장
private pendingGithubState?: GithubStateData;

socket.on("github_state", (data) => {
  if (this.contributionController) {
    this.contributionController.setContributions(data.contributions);
  } else {
    this.pendingGithubState = data;
  }
});

setContributionController(controller) {
  this.contributionController = controller;
  if (this.pendingGithubState) {
    controller.setContributions(this.pendingGithubState.contributions);
    this.pendingGithubState = undefined;
  }
}
```

### 가설 4 해결: username 정규화

- OAuth 로그인 시 username 소문자 변환 등 정규화
- 비교 시 case-insensitive 처리

---

## 다음 단계

1. **디버깅 로그 추가** - 위 제안된 위치에 로그 추가
2. **재현 시도** - 시나리오 A, B, C 순서로 재현
3. **로그 분석** - 어느 단계에서 0이 되는지 확인
4. **가설 검증** - 로그 결과로 원인 특정
5. **버그 수정** - 해당 가설의 해결 방안 적용
6. **테스트** - 수정 후 재현 테스트

---

## 브랜치

```
fix/#198-contribution-zero
```
