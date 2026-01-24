# Issue #229: 소켓 연결 시 JWT 만료 검증 추가

## 개요

| 항목 | 내용 |
|------|------|
| 이슈 | [#229](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/229) |
| 제목 | 소켓 연결 시 JWT 만료 검증 추가 |
| 영역 | Backend, Frontend |
| 브랜치 | `fix/#212-401-relogin` (이슈 #212와 함께 해결) |

---

## 참조한 문서

- [AUTH_FLOW.md](../features/AUTH_FLOW.md): JWT 인증 흐름
- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md): 소켓 이벤트 명세

---

## 문제 상황

**현재 동작:**

1. 소켓 연결 시점에만 JWT 검증 (`handleConnection`)
2. 연결 후 JWT가 만료되어도 소켓 통신 계속 작동
3. REST API는 401 반환 vs 소켓은 계속 동작 (불일치)

**예시 시나리오:**

```
JWT 만료됨
    ↓
사용자가 게임에서 돌아다님 (moving 이벤트)
    ↓
집중 시작/종료도 잘 됨 (focusing/resting 이벤트)
    ↓
Task 생성 시도 (REST API)
    ↓
그제서야 401 → 로그인 페이지
```

**예상 동작:**

- JWT 만료 시 소켓도 연결 해제
- 사용자에게 로그인 페이지로 안내

---

## 원인 분석

`backend/src/player/player.gateway.ts`:

```typescript
handleConnection(client: Socket) {
  const isValid = this.wsJwtGuard.verifyClient(client);
  // 연결 시점에만 검증, 이후 검증 없음
  if (!isValid) {
    client.disconnect();
    return;
  }
}
```

`backend/src/auth/ws-jwt.guard.ts`:

```typescript
canActivate(context: ExecutionContext): boolean {
  const client: Socket = context.switchToWs().getClient();
  const user = client.data?.user;
  // client.data.user 존재 여부만 확인
  // JWT 만료 여부 재검증 없음
  if (!user) {
    throw new WsException('Unauthorized');
  }
  return true;
}
```

---

## 해결 방안

### 1. 서버에서 주기적으로 JWT 만료 검증 (1분 간격)

- 모든 연결된 소켓의 JWT 유효성 검사
- 만료된 경우 `auth_expired` 이벤트 전송 후 disconnect
- 클라이언트에서 `auth_expired` 수신 시 로그인 페이지로 이동

### 2. 클라이언트에서 disconnect 시 JWT 확인

- `disconnect` 이벤트 수신 시 `/auth/me` API 호출
- 401 응답 → JWT 만료 → 로그인 페이지로 이동
- 네트워크 에러 또는 200 → 서버 문제 → "연결 끊김" UI 표시

**이 방식으로 두 상황을 명확히 구분:**

| 상황 | `/auth/me` 응답 | 결과 |
|------|----------------|------|
| JWT 만료 | 401 | `/login`으로 이동 |
| 서버 다운 | 네트워크 에러 | "연결 끊김" UI |
| 서버 일시적 문제 | 200 | "연결 끊김" UI |

### 검토한 대안들

| 방식 | 장점 | 단점 | 선택 |
|------|------|------|------|
| 모든 이벤트마다 검증 | 즉각 감지 | `moving` 이벤트 부하 큼 | ❌ |
| `moving` 제외 이벤트만 검증 | 부하 적음 | 구멍 있음 (moving만 하면 검증 안 됨) | ❌ |
| 주기적 서버 검증 (1분) | 확실, 부하 적당 | 최대 1분 지연 | ✅ |

---

## 상세 구현

### 1. WsJwtGuard에 토큰 검증 메서드 추가

**파일:** `backend/src/auth/ws-jwt.guard.ts`

```typescript
/**
 * 소켓의 JWT 토큰이 유효한지 검증
 * 주기적 검증에서 사용
 */
verifyToken(client: Socket): boolean {
  try {
    const token = this.extractToken(client);
    if (!token) {
      return false;
    }
    this.jwtService.verify(token);
    return true;
  } catch {
    return false;
  }
}
```

### 2. PlayerGateway에 주기적 검증 추가

**파일:** `backend/src/player/player.gateway.ts`

```typescript
import { OnModuleDestroy } from '@nestjs/common';

@WebSocketGateway()
export class PlayerGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private jwtCheckInterval: NodeJS.Timeout;

  afterInit() {
    // 1분마다 모든 연결된 소켓의 JWT 검증
    this.jwtCheckInterval = setInterval(() => {
      this.server.sockets.sockets.forEach((socket) => {
        if (!this.wsJwtGuard.verifyToken(socket)) {
          this.logger.log(`JWT expired for socket: ${socket.id}`);
          socket.emit('auth_expired');
          socket.disconnect();
        }
      });
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.jwtCheckInterval) {
      clearInterval(this.jwtCheckInterval);
    }
  }
}
```

> **Note:** `auth_expired` 이벤트 전송 후 즉시 disconnect합니다. 클라이언트가 frozen 상태로 이벤트를 못 받아도, `disconnect` 핸들러에서 `/auth/me` 호출로 JWT 만료를 감지합니다.

### 3. 프론트엔드에서 auth_expired 및 disconnect 처리

**파일:** `frontend/src/game/managers/SocketManager.ts`

```typescript
connect(callbacks: {
  showSessionEndedOverlay: () => void;
  showConnectionLostOverlay: () => void;
  hideConnectionLostOverlay: () => void;
}): void {
  const socket = connectSocket();

  // ... 기존 코드 ...

  // JWT 만료 시 로그인 페이지로 이동 (서버에서 주기적 검증으로 감지)
  socket.on('auth_expired', () => {
    window.location.href = '/login';
  });

  // 연결 끊김 시 JWT 만료 vs 서버 다운 구분
  socket.on('disconnect', async (reason) => {
    // 세션 교체된 경우 제외
    if (this.isSessionReplaced) return;
    // 클라이언트가 의도적으로 끊은 경우 제외
    if (reason === 'io client disconnect') return;

    // JWT 유효성 확인
    try {
      const res = await fetch('/auth/me', { credentials: 'include' });
      if (res.status === 401) {
        // JWT 만료 → 로그인 페이지
        window.location.href = '/login';
        return;
      }
    } catch {
      // 네트워크 에러 (서버 다운) - 아래에서 연결 끊김 UI 표시
    }

    // 서버 문제 → 연결 끊김 UI
    callbacks.showConnectionLostOverlay();
  });
}
```

---

## 브라우저 Frozen 상태 처리

브라우저가 frozen 상태(탭 백그라운드, 절전 모드)일 때도 정상 처리됩니다:

```
브라우저 frozen 상태
    ↓
서버 setInterval 실행 → JWT 만료 감지
    ↓
socket.emit('auth_expired') → 클라이언트 frozen이라 수신 못함
socket.disconnect() → 서버에서 즉시 연결 해제
    ↓
브라우저 다시 active
    ↓
Socket.io 연결 끊긴 상태 감지 → 'disconnect' 이벤트 발생
    ↓
fetch('/auth/me') 호출 → 401 응답
    ↓
window.location.href = '/login' → 로그인 페이지로 이동
```

**결과:** frozen-tab에서도 JWT 만료 시 로그인 페이지로 정확히 이동합니다.

> **Note:** `auth_expired` 이벤트는 ack를 사용하지 않습니다. 클라이언트가 이벤트를 수신하지 못해도 `disconnect` 핸들러가 백업 로직으로 동작하므로 안전합니다.

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/auth/ws-jwt.guard.ts` | `verifyToken` 메서드 추가 |
| `backend/src/player/player.gateway.ts` | 주기적 JWT 검증 로직 추가 |
| `frontend/src/game/managers/SocketManager.ts` | `auth_expired` 이벤트 및 disconnect 시 JWT 확인 처리 추가 |
| `docs/api/SOCKET_EVENTS.md` | `auth_expired` 이벤트 추가 + "연결 끊김 처리" 섹션 업데이트 (아래 참조) |
| `docs/features/AUTH_FLOW.md` | JWT 설정 섹션 추가 (expiresIn: 1d 명시) |

---

## SOCKET_EVENTS.md 업데이트 내용

`docs/api/SOCKET_EVENTS.md`에 다음 내용을 반영합니다:

### 1. auth_expired 이벤트 추가

```markdown
### auth_expired (S→C)

JWT 토큰이 만료되어 서버가 연결을 해제할 때 전송

**Payload:** 없음

**Ack:** 없음

**클라이언트 처리:**
- 이벤트 수신 시 즉시 `/login` 페이지로 이동
- 클라이언트가 frozen 상태로 이벤트를 수신하지 못해도,
  `disconnect` 이벤트 핸들러에서 `/auth/me` 호출로 JWT 만료를 감지함

**서버 동작:**
- `auth_expired` emit 후 즉시 `socket.disconnect()` 호출
- 클라이언트 응답(ack)을 기다리지 않음
```

### 2. "연결 끊김 처리" 섹션 업데이트

기존 `disconnect` 핸들러 부분만 다음으로 교체 (connect 핸들러는 유지):

```typescript
// SocketManager.ts
socket.on('disconnect', async (reason) => {
  // 세션 교체된 경우 제외
  if (this.isSessionReplaced) return;
  // 클라이언트가 의도적으로 끊은 경우 제외
  if (reason === 'io client disconnect') return;

  // JWT 유효성 확인으로 만료 vs 서버 다운 구분
  try {
    const res = await fetch('/auth/me', { credentials: 'include' });
    if (res.status === 401) {
      // JWT 만료 → 로그인 페이지
      window.location.href = '/login';
      return;
    }
  } catch {
    // 네트워크 에러 (서버 다운) - 아래에서 연결 끊김 UI 표시
  }

  // 서버 문제 → 연결 끊김 UI
  callbacks.showConnectionLostOverlay();
});
```

disconnect reason 테이블에 추가:

| reason | 설명 | 처리 |
|--------|------|------|
| `io server disconnect` | 서버가 연결 종료 (JWT 만료 포함) | `/auth/me`로 JWT 확인 후 분기 |

---

## 테스트 계획

### CI 테스트

```bash
cd backend && pnpm lint && pnpm format && pnpm build && pnpm test
cd frontend && pnpm lint && pnpm format && pnpm build && pnpm test --run
```

### 수동 테스트

> **Note:** JWT 만료 시간은 1일(`1d`)로 설정되어 있습니다. 쿠키 삭제는 이미 연결된 소켓의 handshake 데이터를 변경하지 않으므로, 실제 JWT 만료 테스트는 짧은 만료 시간으로 토큰을 발급하거나 개발 환경에서 `expiresIn`을 조정해야 합니다.

- [ ] **JWT 만료 테스트** (개발 환경에서 `expiresIn: '1m'`으로 변경 후)
  - 로그인 → 1분 대기 → `auth_expired` 이벤트로 로그인 페이지 이동 확인
- [ ] 서버 종료 후 disconnect → "연결 끊김" UI 표시 확인
- [ ] 정상 인증 상태에서는 주기적 검증 통과 확인
- [ ] 브라우저 frozen 후 복귀 시 JWT 만료면 로그인 페이지 이동 확인

---

## 커밋 계획

이슈 #212와 함께 하나의 브랜치에서 해결:

```bash
git checkout fix/#212-401-relogin

# 커밋 1: REST API 401 처리
git commit -m "fix: REST API 401 응답 시 로그인 페이지로 리다이렉트"

# 커밋 2: 소켓 JWT 검증
git commit -m "fix: 소켓 연결 시 주기적 JWT 만료 검증 추가"
```

---

## PR 정보

**제목:** `fix: 인증 만료 시 로그인 페이지로 리다이렉트`

**본문:**

```markdown
## 🔗 관련 이슈
- close: #212
- close: #229

## ✅ 작업 내용

### REST API 401 처리 (#212)
- fetchApi에서 401 응답 감지 시 `/login`으로 즉시 리다이렉트

### 소켓 JWT 만료 검증 (#229)
- 서버에서 1분마다 연결된 소켓의 JWT 만료 검증
- JWT 만료 시 `auth_expired` 이벤트 전송 후 disconnect
- 클라이언트에서 disconnect 시 `/auth/me` 호출하여 JWT 만료 vs 서버 다운 구분
- JWT 만료 → 로그인 페이지, 서버 다운 → "연결 끊김" UI

## 🧪 테스트
- 쿠키 삭제 후 REST API 호출 시 로그인 페이지로 이동 확인
- JWT 만료 테스트 (개발 환경에서 `expiresIn: '1m'` 설정 후 1분 대기)
- 서버 종료 시 "연결 끊김" UI 표시 확인

## 💡 체크리스트
- [ ] PR 제목을 형식에 맞게 작성했나요?
- [ ] 브랜치 전략에 맞는 브랜치에 PR을 올리고 있나요?
```

---

## 관련 문서

- [20260123_ISSUE_212_401_RELOGIN.md](./20260123_ISSUE_212_401_RELOGIN.md) - REST API 401 처리
