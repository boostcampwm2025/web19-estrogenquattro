# 포커스 타임

## 개요

플레이어의 일별 집중 상태와 누적 집중 시간을 기록한다. 상태는 `FOCUSING` 또는 `RESTING`이며,
집중 시작/종료는 소켓 이벤트로 전파된다.

---

## 데이터 모델

`DailyFocusTime`은 하루에 하나의 레코드를 사용한다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `player_id` | bigint | 플레이어 ID |
| `total_focus_seconds` | int | 누적 집중 시간(초) |
| `created_at` | datetime | 집계 기준일 (KST 00:00) |
| `status` | enum | `FOCUSING` \| `RESTING` (V2에서 deprecated) |
| `last_focus_start_time` | datetime | V2에서 deprecated |
| `current_task_id` | int | V2에서 deprecated |

> **V2 상태 소스:** 실제 집중 상태는 `players.last_focus_start_time`(=`Player.lastFocusStartTime`, null 여부), 현재 집중 태스크는 `players.focusing_task_id`(=`Player.focusingTaskId`)를 사용합니다.

---

## 상태 전이

1. **방 입장 (`joining`)**: `settleStaleSession`으로 미정산 세션을 먼저 정리한 뒤 당일 레코드 생성/조회
2. **focusing**: `Player.lastFocusStartTime` 기록, `Player.focusingTaskId` 저장 (선택)
3. **resting**: 집중 시간 누적 후 `players.last_focus_start_time`(V2) = `null`, `players.focusing_task_id` = `null`
4. **disconnect**: `RESTING` 처리 시도 (예외는 로깅)

```mermaid
stateDiagram-v2
    [*] --> RESTING: 방 입장 (findOrCreate)
    RESTING --> FOCUSING: focusing 이벤트
    FOCUSING --> RESTING: resting 이벤트
    FOCUSING --> RESTING: disconnect
```

---

## 재접속 stale 정산 정책 (Issue #456)

- 적용 경로: `PlayerGateway.handleJoin` → `FocusTimeService.settleStaleSession`
- stale 허용 최대 구간: `600초 (10분)`
- 10분 초과 stale 세션은 `600초`만 누적 후 `players.last_focus_start_time`, `players.focusing_task_id`를 초기화
- 정상 `focusing -> resting` 경로(`startResting`)에는 이 상한을 적용하지 않음

---

## 소켓 이벤트

### 클라이언트 → 서버

```typescript
socket.emit('focusing', { taskName?: string, taskId?: number });  // taskName, taskId는 선택
socket.emit('resting');
```

### 서버 → 클라이언트

```typescript
socket.on('focused', (data: {
  userId: string,
  username: string,
  status: 'FOCUSING',
  lastFocusStartTime: string,
  totalFocusSeconds: number,
  currentSessionSeconds: number,  // 서버가 계산한 경과 시간
  taskName?: string
}) => {});

socket.on('rested', (data: {
  userId: string,
  username: string,
  status: 'RESTING',
  totalFocusSeconds: number
}) => {});
```

---

## 시퀀스 다이어그램

### 1. 로컬 플레이어 집중 시작

```mermaid
sequenceDiagram
    participant Browser as 브라우저 (로컬)
    participant Store as useFocusTimeStore
    participant Server as 서버
    participant DB as DB
    participant Others as 다른 플레이어들

    Browser->>Store: 집중 버튼 클릭
    Store->>Server: emit('focusing', { taskName })
    Store->>Store: status = FOCUSING<br/>isFocusTimerRunning = true

    Server->>DB: startFocusing(playerId)
    Note over DB: status = FOCUSING<br/>lastFocusStartTime = now()
    DB-->>Server: focusTime

    Server->>Others: emit('focused', { userId, status,<br/>lastFocusStartTime, totalFocusSeconds,<br/>currentSessionSeconds, taskName })
```

### 2. 로컬 플레이어 휴식 시작

```mermaid
sequenceDiagram
    participant Browser as 브라우저 (로컬)
    participant Store as useFocusTimeStore
    participant Server as 서버
    participant DB as DB
    participant Others as 다른 플레이어들

    Browser->>Store: 휴식 버튼 클릭
    Store->>Server: emit('resting')
    Store->>Store: status = RESTING<br/>isFocusTimerRunning = false

    Server->>DB: startResting(playerId)
    Note over DB: elapsed = now - lastFocusStartTime<br/>totalFocusSeconds += elapsed<br/>status = RESTING<br/>(daily_focus_time.last_focus_start_time 유지, V1 deprecated)<br/>players.last_focus_start_time = null (V2)
    DB-->>Server: focusTime

    Server->>Others: emit('rested', { userId, status,<br/>totalFocusSeconds })
```

### 3. 다른 플레이어 집중 시작 (focused 이벤트 수신)

```mermaid
sequenceDiagram
    participant Remote as 원격 플레이어 (honki)
    participant Server as 서버
    participant Browser as 브라우저 (fpg)
    participant RP as RemotePlayer

    Remote->>Server: emit('focusing')
    Server->>Browser: emit('focused', { userId: honki,<br/>currentSessionSeconds: 0, ... })

    Browser->>RP: setFocusState(true, options)
    Note over RP: currentSeconds = 0 (서버값)<br/>1초마다 +1 증가<br/>표시: totalSeconds + currentSeconds
```

### 4. 다른 플레이어 휴식 시작 (rested 이벤트 수신)

```mermaid
sequenceDiagram
    participant Remote as 원격 플레이어 (honki)
    participant Server as 서버
    participant Browser as 브라우저 (fpg)
    participant RP as RemotePlayer

    Remote->>Server: emit('resting')
    Server->>Browser: emit('rested', { userId: honki,<br/>totalFocusSeconds: 900 })

    Browser->>RP: setFocusState(false, options)
    Note over RP: 타이머 정지<br/>표시: 15초 (고정)
```

### 5. 새 플레이어 입장 (players_synced)

```mermaid
sequenceDiagram
    participant New as 새 플레이어 (alice)
    participant Server as 서버
    participant DB as DB

    New->>Server: emit('joining', { x, y, username })

    Server->>DB: findAllStatuses(roomPlayerIds)
    DB-->>Server: [{ fpg: FOCUSING, 600s }, { honki: RESTING, 300s }]

    Server->>New: emit('players_synced', [<br/>  { id: fpg, status: FOCUSING,<br/>    totalFocusSeconds: 600,<br/>    currentSessionSeconds: 120 },<br/>  { id: honki, status: RESTING,<br/>    totalFocusSeconds: 300 }<br/>])

    Note over New: 각 RemotePlayer 생성<br/>fpg: 600초 + 120초 = 720초, 1초씩 증가<br/>honki: 300초 (고정)
```

### 6. 새로고침 (joined 이벤트)

```mermaid
sequenceDiagram
    participant Browser as 브라우저 (fpg)
    participant Server as 서버
    participant DB as DB

    Note over Browser: 페이지 새로고침
    Browser->>Server: emit('joining', { x, y, username })

    Server->>DB: findOrCreate(player)
    DB-->>Server: focusTime { status: FOCUSING, totalFocusSeconds: 600 }

    Server->>Browser: emit('joined', {<br/>  roomId,<br/>  focusTime: { status, totalFocusSeconds,<br/>    currentSessionSeconds }<br/>})

    Browser->>Browser: syncFromServer(focusTime)
    Note over Browser: 서버 값으로 복원 ✓
```

### 7. Task 이름 변경

```mermaid
sequenceDiagram
    participant Browser as 브라우저 (fpg, 집중 중)
    participant Server as 서버
    participant Others as 다른 플레이어들

    Browser->>Browser: Task 이름 수정 "코딩" → "리뷰"
    Browser->>Server: API: PATCH /api/tasks/:id
    Browser->>Server: emit('focus_task_updating', { taskName: "리뷰" })

    Server->>Others: emit('focus_task_updated', { userId, taskName })

    Note over Others: 말풍선 "리뷰"로 변경 ✓<br/>시간은 유지 (리셋 안 함)
```

---

## 시간 계산 방식

### 문제점

클라이언트에서 `Date.now() - lastFocusStartTime`으로 계산하면 클라이언트 시계에 의존하게 되어 음수가 발생할 수 있음.

### 해결 방식

서버에서 `currentSessionSeconds`를 계산하여 전송:

```typescript
// 서버
currentSessionSeconds = Math.floor((Date.now() - lastFocusStartTime.getTime()) / 1000)

// 클라이언트
let seconds = currentSessionSeconds;  // 서버 값으로 시작
setInterval(() => seconds++, 1000);   // 1초마다 +1 증가
```

---

## 주의사항

- 방 입장 전에 `focusing/resting`을 호출하면 에러가 발생할 수 있다.
- `joining` 시 stale 정산은 최대 10분까지만 반영된다(과대 정산 방지 목적).
- 조회 시 `startAt`, `endAt` UTC 범위를 기준으로 `created_at`(datetime) 필드를 사용한다.
- 클라이언트 시계와 서버 시계가 다를 수 있으므로 시간 계산은 서버에서 수행한다.
