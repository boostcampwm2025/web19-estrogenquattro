# GitHub Polling 흐름

## 개요

클라이언트가 방에 입장하면 GitHub 이벤트 폴링이 시작되고, 퇴장 시 중지됩니다.

---

## 전체 흐름

```mermaid
sequenceDiagram
    participant C as Client
    participant PG as PlayerGateway
    participant GPS as GithubPollService
    participant GG as GithubGateway
    participant API as GitHub API

    C->>PG: join_room
    PG->>GPS: subscribeGithubEvent(connectedAt, clientId, roomId)
    GPS->>GPS: setInterval(60초)

    loop 60초마다
        GPS->>API: GET /users/{username}/events
        API-->>GPS: events[]
        GPS->>GPS: 새 이벤트 필터링
        GPS->>GG: castGithubEventToRoom(event, roomId)
        GG-->>C: githubEvent (broadcast)
    end

    C->>PG: disconnect
    PG->>GPS: unsubscribeGithubEvent(clientId)
    GPS->>GPS: clearInterval
```

---

## 컴포넌트 역할

| 컴포넌트 | 역할 |
|----------|------|
| **PlayerGateway** | 클라이언트 연결/해제 감지, 폴링 등록/해제 트리거 |
| **GithubPollService** | 폴링 스케줄 관리, GitHub API 호출, 이벤트 필터링 |
| **GithubGateway** | 폴링 결과를 해당 방의 클라이언트들에게 브로드캐스트 |

---

## 데이터 구조

### PollingSchedule (클라이언트별 폴링 상태)

```
Map<clientId, {
  interval: NodeJS.Timeout,    // setInterval 참조
  lastProcessedAt: Date        // 마지막 처리 시점
}>
```

### 브로드캐스트 데이터

```
{
  clientId: string,
  pushCount: number,           // PushEvent 개수
  pullRequestCount: number     // PullRequestEvent 개수
}
```

---

## 상세 흐름

### 1. 폴링 등록

```mermaid
flowchart TD
    A[클라이언트 join_room] --> B[PlayerGateway.handleJoinRoom]
    B --> C[GithubPollService.subscribeGithubEvent]
    C --> D{이미 등록된 clientId?}
    D -->|Yes| E[무시]
    D -->|No| F[setInterval 등록 - 60초 주기]
    F --> G[pollingSchedules Map에 저장]
```

### 2. 폴링 실행 (60초마다)

```mermaid
flowchart TD
    A[setInterval 콜백 실행] --> B[handlePoll]
    B --> C[pollGithubEvents]
    C --> D[GitHub API 호출]
    D --> E[lastProcessedAt 이후 이벤트 필터링]
    E --> F[PushEvent, PullRequestEvent 집계]
    F --> G[lastProcessedAt 갱신]
    G --> H[GithubGateway.castGithubEventToRoom]
    H --> I[해당 room 클라이언트에게 전송]
```

### 3. 폴링 해제

```mermaid
flowchart TD
    A[클라이언트 disconnect] --> B[PlayerGateway.handleDisconnect]
    B --> C[GithubPollService.unsubscribeGithubEvent]
    C --> D[clearInterval - 폴링 중지]
    D --> E[pollingSchedules Map에서 삭제]
```

---

## 설계 특징

### 클라이언트 단위 폴링

- 각 클라이언트마다 독립적인 폴링 스케줄 관리
- 연결 시점(`connectedAt`)을 기준으로 새 이벤트만 감지

### 중복 이벤트 방지

- `lastProcessedAt`보다 이후의 이벤트만 필터링
- 폴링 시마다 `lastProcessedAt` 갱신

### Room 기반 브로드캐스트

- Socket.IO의 room 기능 활용
- 같은 방의 모든 클라이언트에게 이벤트 전송

---

## 현재 제약 사항

| 항목 | 현재 상태 | 비고 |
|------|----------|------|
| 사용자 식별 | 하드코딩된 테스트 유저 | 추후 OAuth 연동 필요 |
| API 인증 | Public API (인증 없음) | Rate Limit 제한적 |
| 폴링 주기 | 60초 고정 | 설정 가능하게 개선 가능 |
| ETag 최적화 | 미적용 | Rate Limit 절약 가능 |
