# Socket.io 이벤트 명세

## 연결

### 연결 설정

```typescript
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  withCredentials: true,  // 쿠키 전송 (JWT)
  autoConnect: false,
});
```

### 연결 시 JWT 검증

- `WsJwtGuard`가 handshake 시 쿠키의 JWT 검증
- 검증 실패 시 연결 거부 (`disconnect`)
- 검증 성공 시 `socket.data.user`에 사용자 정보 저장

---

## 상태

- **Implemented:** 아래 본문에 상세 설명된 이벤트
- **Planned/Optional:** 현재 없음

---

## 클라이언트 → 서버

### joining

방 입장 요청

```typescript
socket.emit('joining', {
  x: number,        // 초기 X 좌표
  y: number,        // 초기 Y 좌표
  username: string  // 사용자명 (표시용)
});
```

**서버 동작:**
1. 랜덤 방 배정 (`RoomService.randomJoin`)
2. 중복 접속 시 이전 세션 종료 (`session_replaced`)
3. 플레이어 정보 저장 및 방 플레이어 등록
4. 기존 플레이어 목록 전송 (`players_synced`, 포커스 상태 포함)
5. 다른 플레이어에게 입장 알림 (`player_joined`)
6. 포커스 타임 레코드 생성/조회
7. GitHub 폴링 시작
8. 현재 룸 상태 전송 (`github_state`)

---

### moving

플레이어 이동

```typescript
socket.emit('moving', {
  x: number,           // 현재 X 좌표
  y: number,           // 현재 Y 좌표
  isMoving: boolean,   // 이동 중 여부
  direction: Direction, // 'up' | 'down' | 'left' | 'right'
  timestamp: number    // 타임스탬프
});
```

**서버 동작:**
- 플레이어 위치 최신화
- 같은 방에 `moved` 브로드캐스트

---

### chatting

채팅 메시지 전송

```typescript
socket.emit('chatting', {
  message: string  // 채팅 메시지
});
```

**서버 동작:**
- 같은 방에 `chatted` 브로드캐스트

---

### focusing

집중 시작 (방 입장 후 호출)

```typescript
socket.emit('focusing', {
  taskName?: string,  // 집중할 태스크 이름 (선택)
  taskId?: number     // 집중할 태스크 ID (선택, 서버에 집중 시간 누적용)
});
```

**서버 동작:**
- 포커스 상태를 `FOCUSING`으로 변경
- `taskId`가 있으면 존재/소유권 검증 후 `currentTaskId`에 저장 (휴식 시 해당 Task에 집중 시간 누적)
- 같은 방에 `focused` 브로드캐스트 (taskName 포함)

**응답 (ack):**
```typescript
// 성공
{ success: true, data: { userId, username, status, totalFocusSeconds, currentSessionSeconds, taskName? } }

// 실패
{ success: false, error: string }
```

---

### resting

휴식 시작 (방 입장 후 호출)

```typescript
socket.emit('resting');
```

**서버 동작:**
- 포커스 상태를 `RESTING`으로 변경, 집중 시간 누적
- `currentTaskId`가 있으면 해당 Task의 `totalFocusSeconds`에도 집중 시간 누적
- 같은 방에 `rested` 브로드캐스트

**응답 (ack):**
```typescript
// 성공
{ success: true, data: { userId, username, status, totalFocusSeconds } }

// 실패
{ success: false, error: string }
```

---

### focus_task_updating

집중 중인 태스크 이름 변경 (FOCUSING 상태에서만 호출)

```typescript
socket.emit('focus_task_updating', {
  taskName: string  // 변경된 태스크 이름
});
```

**서버 동작:**
- `lastFocusStartTime`을 변경하지 않음 (집중 세션 유지)
- 같은 방에 `focus_task_updated` 브로드캐스트

**응답 (ack):**
```typescript
// 성공
{ success: true, data: { userId, username, taskName } }
```

---

### pet_equipping

대표 펫 장착 알림 (방 입장 후 호출)

```typescript
socket.emit('pet_equipping', {
  petId: number | null  // 장착한 펫 ID (null이면 해제)
});
```

**서버 동작:**
1. `petId` 타입 검증
2. DB에서 플레이어 정보 조회
3. 클라이언트가 보낸 `petId`와 DB의 `equippedPetId` 일치 여부 검증 (스푸핑 방지)
4. 검증 통과 시 DB에서 `petImage` 조회
5. 인메모리 상태 업데이트
6. 같은 방에 `pet_equipped` 브로드캐스트 (검증된 petImage 사용)

**보안:**
- 클라이언트가 임의의 `petImage`를 보내는 것을 방지
- 서버에서 DB 기준으로 검증된 값만 브로드캐스트

---

## 서버 → 클라이언트

### joined

방 입장 완료 알림 (로컬 플레이어에게 전송)

```typescript
socket.on('joined', (data: {
  roomId: string,
  focusTime: {
    status: 'FOCUSING' | 'RESTING',
    totalFocusSeconds: number,
    currentSessionSeconds: number  // 서버가 계산한 현재 세션 경과 시간 (초)
  }
}) => {
  // roomId 저장
  // focusTime으로 로컬 상태 복원 (새로고침 대응)
});
```

---

### players_synced

기존 플레이어 목록 (입장 시 수신)

```typescript
socket.on('players_synced', (players: Array<{
  socketId: string,
  userId: string,
  username: string,
  roomId: string,
  x: number,
  y: number,
  playerId: number,
  petImage: string | null,  // 장착된 펫 이미지 URL
  status: 'FOCUSING' | 'RESTING',
  lastFocusStartTime: string | null,
  totalFocusSeconds: number,
  currentSessionSeconds: number  // 서버가 계산한 현재 세션 경과 시간 (초)
}>) => {
  // RemotePlayer 생성
});
```

---

### player_joined

새 플레이어 입장 알림

```typescript
socket.on('player_joined', (data: {
  userId: string,
  username: string,
  x: number,
  y: number,
  playerId: number,
  petImage: string | null,  // 장착된 펫 이미지 URL
  status: 'FOCUSING' | 'RESTING',
  totalFocusSeconds: number,
  currentSessionSeconds: number  // 서버가 계산한 현재 세션 경과 시간 (초)
}) => {
  // RemotePlayer 생성
});
```

---

### player_left

플레이어 퇴장 알림

```typescript
socket.on('player_left', (data: {
  userId: string
}) => {
  // RemotePlayer 제거
});
```

---

### moved

플레이어 이동 알림

```typescript
socket.on('moved', (data: {
  userId: string,
  x: number,
  y: number,
  isMoving: boolean,
  direction: Direction,
  timestamp: number
}) => {
  // RemotePlayer 위치 업데이트
});
```

---

### chatted

채팅 메시지 수신

```typescript
socket.on('chatted', (data: {
  userId: string,
  message: string
}) => {
  // 해당 플레이어에 말풍선 표시
});
```

---

### github_event

GitHub 활동 감지 알림

```typescript
socket.on('github_event', (data: {
  username: string,
  pushCount: number,      // 새 커밋 수
  pullRequestCount: number // 새 PR 수
}) => {
  // 프로그레스바 업데이트
  // 기여도 목록 업데이트
});
```

---

### github_state

현재 룸의 GitHub 상태 (입장 시 수신)

```typescript
socket.on('github_state', (state: {
  progress: number,
  contributions: Record<string, number>  // username -> count
}) => {
  // 프로그레스바 초기값 설정
  // 기여도 목록 초기값 설정
});
```

---

### focused

집중 시작 알림

```typescript
socket.on('focused', (data: {
  userId: string,
  username: string,
  status: 'FOCUSING',
  lastFocusStartTime: string,
  totalFocusSeconds: number,
  currentSessionSeconds: number,  // 서버가 계산한 현재 세션 경과 시간 (초)
  taskName?: string
}) => {
  // 포커스 상태 표시 업데이트
});
```

---

### rested

휴식 시작 알림

```typescript
socket.on('rested', (data: {
  userId: string,
  username: string,
  status: 'RESTING',
  totalFocusSeconds: number
}) => {
  // 포커스 상태 및 누적 시간 표시 업데이트
});
```

---

### focus_task_updated

집중 태스크 이름 변경 알림

```typescript
socket.on('focus_task_updated', (data: {
  userId: string,
  username: string,
  taskName: string
}) => {
  // RemotePlayer의 태스크 말풍선 업데이트
});
```

---

### pet_equipped

펫 장착 변경 알림

```typescript
socket.on('pet_equipped', (data: {
  userId: string,
  petImage: string | null  // 펫 이미지 URL (null이면 펫 해제)
}) => {
  // RemotePlayer의 펫 이미지 업데이트
});
```

---

### session_replaced

세션 대체 알림 (다른 탭에서 로그인 시)

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

```
Client A                    Server                    Client B
    |                         |                          |
    |-- joining ------------->|                          |
    |                         |-- player_joined -------->|
    |<-- players_synced ------|                          |
    |<-- github_state --------|                          |
    |                         |                          |
    |-- moving -------------->|                          |
    |                         |-- moved ---------------->|
    |                         |                          |
    |-- chatting ------------>|                          |
    |                         |-- chatted -------------->|
    |                         |                          |
    |                   [GitHub Poll]                    |
    |<-- github_event --------|-- github_event --------->|
    |                         |                          |
    |-- pet_equipping ------->|                          |
    |                   [DB 검증: petId == equippedPetId]|
    |                         |-- pet_equipped --------->|
    |                         |                          |
```
