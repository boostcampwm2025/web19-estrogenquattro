# Issue #217: 탭 복귀 시 만료된 채팅 말풍선 표시 문제

## 개요

| 항목 | 내용 |
|------|------|
| 이슈 | [#217](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/217) |
| 제목 | 탭 복귀 시 이미 만료된 채팅 말풍선이 표시되는 문제 |
| 영역 | Frontend (Game) + Backend (Chat) |
| 상태 | **보류** |

---

## 참조한 문서

- [GAME_MANAGERS.md](../architecture/GAME_MANAGERS.md): ChatManager 구조, SocketManager의 chatted 이벤트 처리
- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md): chatted 이벤트 명세

---

## 문제 상황

탭 백그라운드 전환 후 복귀 시, 이미 만료된 채팅 말풍선이 잠깐 표시되는 현상

---

## 현재 코드

### 백엔드 (chat.gateway.ts)

```typescript
client.to(roomId).emit('chatted', { userId: client.id, message: data.message });
```

- `durationMs` 없음
- `sentAt` 없음

### 프론트엔드 (SocketManager.ts)

```typescript
socket.on("chatted", (data: { userId: string; message: string }) => {
  const remotePlayer = this.otherPlayers.get(data.userId);
  if (remotePlayer) {
    remotePlayer.showChatBubble(data.message);
  }
});
```

- `receivedAt` 기록 없음
- `visibilitychange` 처리 없음

### 프론트엔드 (BasePlayer.ts)

```typescript
showChatBubble(text: string) {
  // ... 말풍선 생성 ...

  // 5초 후 제거 (하드코딩, 타이머 참조 없음)
  this.scene.time.delayedCall(5000, () => {
    if (bubbleContainer.active) {
      bubbleContainer.destroy();
    }
  });
}
```

---

## 원인 분석

브라우저 탭 상태에 따라 두 가지 케이스 존재:

### Hidden vs Frozen

| 상태 | 트리거 | 빈도 |
|------|--------|:----:|
| **Hidden** | 탭 전환, 창 최소화 | 자주 |
| **Frozen** | 5분+ 백그라운드, 메모리 부족, 모바일 배터리 절약 | 드묾 |

### 동작 차이

| 항목 | Hidden | Frozen |
|------|:------:|:------:|
| JavaScript | throttle됨 | 완전 중지 |
| 타이머 | 최소 1초로 제한 | 완전 중지 |
| 소켓 이벤트 수신 | 즉시 | 즉시 (커널 레벨) |
| 이벤트 핸들러 실행 | 즉시 | Resume 시 실행 |
| `receivedAt` 정확성 | ✅ 정확 | ❌ Resume 시점 |

### Hidden (일반 백그라운드) 문제

```
T=0     채팅 수신, 말풍선 생성, delayedCall(5000) 시작
T=1초   탭 백그라운드 (타이머 throttle)
T=6초   탭 복귀
        → 타이머가 아직 5초 안 지남 (throttle로 느려짐)
        → 말풍선 잠깐 보임 (깜빡임)
```

### Frozen (완전 정지) 문제

```
T=0     탭 Freeze
T=1분   채팅 이벤트 → 큐에 쌓임 (핸들러 실행 안 됨)
T=5분   탭 Resume
        → 이벤트 전달, 핸들러 실행
        → receivedAt = T=5분 (실제 발송은 T=1분)
        → 4분 전 메시지가 "방금 온 것처럼" 5초간 표시
```

---

## 해결 방안 검토

### 방안 1: receivedAt + visibilitychange

- 서버: `durationMs` 전송
- 클라이언트: 수신 시점(`receivedAt`) 기록
- 탭 복귀 시 `visibilitychange`로 만료된 말풍선 정리

| Hidden | Frozen |
|:------:|:------:|
| ✅ 해결 | ❌ 미해결 |

**Frozen 미해결 이유:** `receivedAt`이 Resume 시점으로 찍히므로 오래된 메시지 판단 불가

---

### 방안 2: sentAt + 오프셋 계산

- 서버: `sentAt` (발송 시간) 전송
- 클라이언트: 연결 시 서버-클라이언트 시간 오프셋 계산
- `sentAt`을 클라이언트 시간으로 변환하여 만료 판단

| Hidden | Frozen |
|:------:|:------:|
| ✅ 해결 | ✅ 해결 |

#### 오프셋 계산 원리

```
[연결 시]
T1 = 요청 보낸 시점
T2 = 응답 받은 시점
RTT = T2 - T1
offset = serverTime + (RTT/2) - T2

[채팅 수신 시]
clientSentAt = sentAt - offset  (서버→클라 시간 변환)
elapsed = Date.now() - clientSentAt
elapsed >= 5000 → 무시
```

#### 왜 오프셋이 필요한가?

- 클라이언트 시계가 서버와 다를 수 있음 (NTP 미동기화, 수동 설정 등)
- `Date.now()`는 UTC 기준이지만, 시계 자체가 틀리면 값도 틀림
- 오프셋으로 변환하면 클라이언트 시간끼리 비교 → 시계 차이 무관

#### 커널 수신 시간 접근 불가

- 소켓 이벤트는 커널 레벨에서 수신되지만
- JavaScript에서 커널 수신 시간에 접근할 API 없음
- `socket.on()` 핸들러 실행 시점만 알 수 있음
- → 서버 `sentAt`이 유일한 해결책

---

## 결론: 보류

### 보류 이유

| 항목 | 내용 |
|------|------|
| Frozen 발생 빈도 | 드묾 (5분+ 백그라운드, 모바일 배터리 절약 등) |
| 문제 발생 시 영향 | 오래된 채팅 말풍선이 5초간 표시됨 (치명적이지 않음) |
| 해결 복잡도 | 서버-클라이언트 시간 동기화 로직 추가 필요 |

### 향후 계획

- 사용자 불만 발생 시 방안 2(sentAt + 오프셋)로 개선
- Hidden 케이스만 우선 해결하는 것도 고려 가능

---

## 참고: 방안 2 구현 시 필요한 변경

### 서버

| 파일 | 변경 |
|------|------|
| `chat.gateway.ts` | `sentAt: Date.now()` 추가 |
| `player.gateway.ts` | joining 응답에 `serverTime` 추가 |

### 클라이언트

| 파일 | 변경 |
|------|------|
| `SocketManager.ts` | 오프셋 계산, chatted 핸들러 수정, visibilitychange |
| `BasePlayer.ts` | 타이머/말풍선 참조 관리, clearChatBubble, resetBubbleTimer |

### 주의사항

- 세션 중 클라이언트 시계 변경 시 오프셋 틀어짐 (드문 케이스, 새로고침으로 해결)
- 하위 호환: `sentAt` 없으면 `receivedAt` 방식으로 fallback
