# 방 입장 및 게임 시작 흐름

## 개요

플레이어가 로그인 후 게임에 입장하여 다른 플레이어들과 상호작용을 시작하는 전체 흐름

---

## 방 관리 정책

### 방 설정

| 항목 | 값 | 설명 |
|------|---|------|
| 용량 | 14명 | 방당 최대 인원 |
| 방 개수 | 5개(고정) | room-1 ~ room-5 |
| 자동 생성 | No | 고정된 5개 방만 사용 |
| 배정 방식 | 랜덤 + 선택 진입 | 기본 랜덤, 선택 시 지정 방 진입 |

### 채널 선택(방 선택) API

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/rooms` | 현재 방 목록/인원 조회 |
| PATCH | `/api/rooms/:roomId` | 방 입장 예약 (30초 TTL) |

### 방 상태 전이

```mermaid
stateDiagram-v2
    [*] --> 여유있음: 서버 시작 (room-1 ~ room-5)
    여유있음 --> 여유있음: 플레이어 입장 (size < capacity)
    여유있음 --> 만석: 플레이어 입장 (size = capacity)
    만석 --> 여유있음: 플레이어 퇴장
    만석 --> 입장실패: 지정 방/랜덤 모두 만석
```

---

## 전체 흐름 시퀀스

### 1. 게임 입장 (정상 흐름)

```mermaid
sequenceDiagram
    participant B as 브라우저
    participant P as Phaser Scene
    participant S as Socket 서버
    participant DB as 데이터베이스

    Note over B,DB: 1단계: 인증 및 씬 초기화
    B->>B: 로그인 완료 (JWT 쿠키)
    B->>P: Phaser 게임 시작
    P->>P: MapScene.preload()
    P->>P: MapScene.create()

    Note over B,DB: 2단계: Socket 연결
    P->>S: Socket.io 연결 (withCredentials)
    S->>S: WsJwtGuard 검증
    S-->>P: 연결 성공

    Note over B,DB: 3단계: 방 입장
    P->>S: emit('joining', { x, y, username, roomId? })

    S->>S: roomId 있으면 joinRoom(), 없으면 randomJoin()
    S->>S: 중복 접속 체크

    alt 중복 접속
        S->>S: 이전 세션에 session_replaced 전송
        S->>S: 이전 세션 disconnect
    end

    S->>DB: Player 조회 (펫 정보 포함)
    S->>DB: FocusTime findOrCreate

    Note over B,DB: 4단계: 동기화 이벤트 수신
    S-->>P: emit('players_synced', [...기존 플레이어])
    S-->>P: emit('game_state', { progress, contributions, mapIndex, progressThreshold })
    S-->>P: emit('joined', { roomId, focusTime })

    Note over B,DB: 5단계: 다른 플레이어에게 알림
    S->>S: 같은 방 브로드캐스트
    S-->>B: emit('player_joined', { userId, username, ... })

    Note over B,DB: 6단계: GitHub 폴링 시작
    S->>S: subscribeGithubEvent()
```

### 2. 중복 접속 처리

```mermaid
sequenceDiagram
    participant T1 as 탭 1 (기존)
    participant S as 서버
    participant T2 as 탭 2 (새로운)

    Note over T1,T2: 같은 계정으로 중복 접속
    T1->>S: 기존 연결 유지 중
    T2->>S: emit('joining', ...)

    S->>S: userSockets.get(username)
    Note right of S: 기존 socketId 발견

    S->>T1: emit('session_replaced', { message })
    S->>T1: disconnect()

    T1->>T1: 오버레이 표시<br/>"다른 탭에서 접속..."

    S->>S: userSockets.set(username, newSocketId)
    S-->>T2: 정상 입장 진행
```

### 3. 새로고침 시 상태 복원

```mermaid
sequenceDiagram
    participant B as 브라우저
    participant P as Phaser Scene
    participant S as 서버
    participant DB as 데이터베이스

    Note over B,DB: 페이지 새로고침
    B->>B: 페이지 리로드
    B->>P: Phaser 재시작

    P->>S: Socket 재연결
    P->>S: emit('joining', ...)

    S->>DB: FocusTime 조회
    Note right of DB: 기존 상태 유지됨<br/>(FOCUSING/RESTING)

    S-->>P: emit('joined', { focusTime })
    Note right of P: status, totalFocusSeconds,<br/>currentSessionSeconds 복원

    P->>P: useFocusTimeStore.syncFromServer()
    Note right of P: 로컬 상태 복원
```

---

## 이벤트 상세

### joining (C→S)

클라이언트가 방 입장을 요청

```typescript
socket.emit('joining', {
  x: number,        // 초기 X 좌표
  y: number,        // 초기 Y 좌표
  username: string, // 표시용 사용자명
  roomId?: string   // 선택 입장 시 지정 방 ID (예: room-3)
});
```

**서버 처리:**
1. `roomId`가 있으면 `joinRoom()`, 없으면 `randomJoin()`
2. 중복 접속 체크 및 이전 세션 종료
3. `players` Map에 정보 저장
4. DB에서 Player, FocusTime 조회
5. 동기화 이벤트 전송

---

### joined (S→C)

로컬 플레이어에게 입장 완료 알림

```typescript
socket.on('joined', (data: {
  roomId: string,
  focusTime: {
    status: 'FOCUSING' | 'RESTING',
    totalFocusSeconds: number,
    currentSessionSeconds: number
  }
}) => {
  // roomId 저장
  // focusTime으로 로컬 상태 복원
});
```

---

### players_synced (S→C)

기존 플레이어 목록 전송

```typescript
socket.on('players_synced', (players: Array<{
  socketId: string,
  userId: string,
  username: string,
  roomId: string,
  x: number,
  y: number,
  playerId: number,
  petImage: string | null,
  status: 'FOCUSING' | 'RESTING',
  lastFocusStartTime: string | null,
  totalFocusSeconds: number,
  currentSessionSeconds: number
}>) => {
  // 각 플레이어에 대해 RemotePlayer 생성
});
```

---

### player_joined (S→C)

새 플레이어 입장 알림 (다른 플레이어들에게)

```typescript
socket.on('player_joined', (data: {
  userId: string,
  username: string,
  x: number,
  y: number,
  playerId: number,
  petImage: string | null,
  status: 'FOCUSING' | 'RESTING',
  totalFocusSeconds: number,
  currentSessionSeconds: number
}) => {
  // RemotePlayer 생성
});
```

---

### game_state (S→C)

현재 전역 게임 상태 전송

```typescript
socket.on('game_state', (state: {
  progress: number,
  contributions: Record<string, number>,
  mapIndex: number,
  progressThreshold: number
}) => {
  // 프로그레스바 초기값 설정
  // 기여도 목록 초기값 설정
  // mapIndex 동기화
});
```

---

### join_failed (S→C)

방 입장 실패 알림 (`ROOM_NOT_FOUND`, `ROOM_FULL`)

```typescript
socket.on('join_failed', (data: {
  message: string,
  code: 'ROOM_NOT_FOUND' | 'ROOM_FULL'
}) => {
  // ROOM_FULL: 채널 선택 모달 재오픈
  // ROOM_NOT_FOUND: 로그인 페이지로 이동
});
```

---

### session_replaced (S→C)

다른 탭에서 로그인으로 인한 세션 종료

```typescript
socket.on('session_replaced', (data: {
  message: string
}) => {
  // 연결 해제
  // 오버레이 표시
});
```

---

## 이벤트 흐름 다이어그램

```mermaid
sequenceDiagram
    participant A as Client A (신규)
    participant S as Server
    participant B as Client B (기존, 같은 방)

    A->>S: Socket Connect
    S-->>A: Connected

    A->>S: joining
    S->>S: 방 배정
    S->>S: 중복 체크

    S-->>A: players_synced
    S-->>A: game_state
    S-->>A: joined
    S-->>B: player_joined

    S->>S: GitHub 폴링 시작
```

---

## 관련 문서

- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md) - 소켓 이벤트 전체 명세
- [AUTH_FLOW.md](./AUTH_FLOW.md) - 인증 흐름
- [FOCUS_TIME.md](./FOCUS_TIME.md) - 포커스 타임 시스템
- [GAME_ENGINE.md](../architecture/GAME_ENGINE.md) - 게임 엔진 구조
