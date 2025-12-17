# Socket.io Handshake JWT 검증 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant User as 사용자
    participant Frontend as Frontend<br/>(Next.js)
    participant SocketClient as Socket.io<br/>Client
    participant SocketServer as Socket.io<br/>Server (Gateway)
    participant WsJwtGuard as WsJwtGuard
    participant JwtService as JwtService
    participant UserStore as UserStore

    Note over User, UserStore: 1. 인증된 사용자가 게임 페이지 접속
    User->>Frontend: 메인 페이지 (/) 접속
    Frontend->>Frontend: AuthGuard 통과<br/>(이미 로그인됨)

    Note over User, UserStore: 2. Socket.io 연결 시도 (Handshake)
    Frontend->>SocketClient: Socket 연결 요청
    SocketClient->>SocketServer: connect<br/>(withCredentials: true)

    Note over SocketServer, UserStore: 3. handleConnection에서 JWT 검증
    SocketServer->>WsJwtGuard: verifyClient(socket)
    WsJwtGuard->>WsJwtGuard: 쿠키에서 토큰 추출<br/>(access_token)

    alt 토큰 존재
        WsJwtGuard->>JwtService: verify(token)
        JwtService-->>WsJwtGuard: payload<br/>{sub, username}
        WsJwtGuard->>UserStore: findByGithubId(sub)

        alt 사용자 존재
            UserStore-->>WsJwtGuard: user 정보
            WsJwtGuard->>SocketServer: socket.data.user = user
            WsJwtGuard-->>SocketServer: true (검증 성공)
            SocketServer-->>SocketClient: 연결 성공
            SocketClient-->>Frontend: connected
            Frontend-->>User: 게임 화면 표시
        else 사용자 없음
            UserStore-->>WsJwtGuard: null
            WsJwtGuard-->>SocketServer: false (검증 실패)
            SocketServer->>SocketClient: disconnect
            SocketClient-->>Frontend: 연결 실패
            Frontend->>Frontend: /login으로 리다이렉트
        end
    else 토큰 없음
        WsJwtGuard-->>SocketServer: false (검증 실패)
        SocketServer->>SocketClient: disconnect
        SocketClient-->>Frontend: 연결 실패
        Frontend->>Frontend: /login으로 리다이렉트
    end

    Note over User, UserStore: 4. 연결 후 메시지 통신
    User->>Frontend: 게임 참여 (joining)
    Frontend->>SocketClient: emit('joining', data)
    SocketClient->>SocketServer: joining event
    SocketServer->>SocketServer: socket.data.user로<br/>인증된 사용자 정보 사용
    SocketServer-->>SocketClient: players_synced
    SocketClient-->>Frontend: 다른 플레이어 정보
    Frontend-->>User: 게임 화면 업데이트
```

## Socket.io 인증 처리 방식

| 단계 | 위치 | 설명 |
|-----|------|------|
| 1 | Client | `withCredentials: true`로 쿠키 전송 |
| 2 | handleConnection | WsJwtGuard.verifyClient() 호출 |
| 3 | WsJwtGuard | 쿠키에서 JWT 추출 → 검증 → UserStore 조회 |
| 4 | Gateway | socket.data.user에 사용자 정보 저장 |
| 5 | @SubscribeMessage | socket.data.user로 인증된 사용자 접근 |

## 클라이언트 연결 코드 예시

```typescript
const socket = io(API_URL, {
  withCredentials: true, // httpOnly 쿠키 전송
});
```

## 서버 검증 코드 구조

```typescript
@WebSocketGateway({ cors: { origin: FRONTEND_URL, credentials: true } })
export class PlayerGateway implements OnGatewayConnection {
  constructor(private wsJwtGuard: WsJwtGuard) {}

  async handleConnection(client: Socket) {
    const isValid = await this.wsJwtGuard.verifyClient(client);
    if (!isValid) {
      client.disconnect();
      return;
    }
    // client.data.user에 인증된 사용자 정보 저장됨
  }
}
```
