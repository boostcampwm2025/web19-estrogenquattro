# Issue #310: 채팅 글자수 제한 백엔드 검증 추가

## 개요

채팅 메시지 글자수 제한을 백엔드에서도 검증하여 악의적인 요청 방지

## 배경

- PR #299에서 클라이언트 측 글자수 제한(30자)만 적용됨
- 클라이언트 검증만으로는 DevTools나 직접 Socket 요청으로 우회 가능
- 지나치게 긴 텍스트로 인한 말풍선 오버플로우 및 서버 부하 방지 필요

## 현재 상태

### 프론트엔드 (`frontend/src/game/managers/ChatManager.ts:25`)

```typescript
input.maxLength = 30;
```

- HTML input의 maxLength 속성으로 30자 제한

### 백엔드 (`backend/src/chat/chat.gateway.ts`)

```typescript
@SubscribeMessage('chatting')
handleMessage(
  @MessageBody() data: { message: string },
  @ConnectedSocket() client: Socket,
) {
  if (!this.wsJwtGuard.verifyAndDisconnect(client, this.logger)) return;

  const roomId = this.roomService.getRoomIdBySocketId(client.id);
  if (!roomId) return;
  client
    .to(roomId)
    .emit('chatted', { userId: client.id, message: data.message });
}
```

- 메시지 길이 검증 없음
- 직접 브로드캐스트

## 작업 계획

### 1. 상수 정의

**파일:** `backend/src/chat/chat.constants.ts` (신규)

```typescript
export const CHAT_MAX_LENGTH = 30;
```

### 2. 채팅 이벤트 핸들러 검증 추가

**파일:** `backend/src/chat/chat.gateway.ts`

```typescript
import { CHAT_MAX_LENGTH } from './chat.constants';

@SubscribeMessage('chatting')
handleMessage(
  @MessageBody() data: { message: string },
  @ConnectedSocket() client: Socket,
) {
  if (!this.wsJwtGuard.verifyAndDisconnect(client, this.logger)) return;

  // 메시지 길이 검증
  if (!data.message || data.message.length > CHAT_MAX_LENGTH) {
    this.logger.warn(
      `Message length exceeded: ${data.message?.length ?? 0} > ${CHAT_MAX_LENGTH}`,
    );
    return; // 초과 시 이벤트 무시
  }

  const roomId = this.roomService.getRoomIdBySocketId(client.id);
  if (!roomId) return;
  client
    .to(roomId)
    .emit('chatted', { userId: client.id, message: data.message });
}
```

### 3. 테스트 추가

**파일:** `backend/src/chat/chat.gateway.spec.ts`

```typescript
describe('ChatGateway', () => {
  describe('handleMessage', () => {
    it('30자 이하 메시지는 브로드캐스트된다', () => {
      // Given: 30자 이하 메시지
      // When: chatting 이벤트 처리
      // Then: chatted 이벤트 브로드캐스트
    });

    it('30자 초과 메시지는 무시된다', () => {
      // Given: 31자 이상 메시지
      // When: chatting 이벤트 처리
      // Then: chatted 이벤트 브로드캐스트 안됨
    });

    it('빈 메시지는 무시된다', () => {
      // Given: 빈 문자열 메시지
      // When: chatting 이벤트 처리
      // Then: chatted 이벤트 브로드캐스트 안됨
    });
  });
});
```

## 체크리스트

- [ ] `backend/src/chat/chat.constants.ts` 생성
- [ ] `backend/src/chat/chat.gateway.ts`에 검증 로직 추가
- [ ] `backend/src/chat/chat.gateway.spec.ts` 테스트 추가
- [ ] `/ci` 통과 확인

## 파일 변경 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `backend/src/chat/chat.constants.ts` | 신규 | 상수 정의 |
| `backend/src/chat/chat.gateway.ts` | 수정 | 검증 로직 추가 |
| `backend/src/chat/chat.gateway.spec.ts` | 신규 | 테스트 추가 |

## 참고 문서

- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md) - chatting/chatted 이벤트
- [TEST_CONVENTION.md](../conventions/TEST_CONVENTION.md) - 테스트 작성 규칙
