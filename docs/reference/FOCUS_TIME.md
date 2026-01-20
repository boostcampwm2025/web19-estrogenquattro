# 포커스 타임

## 개요

플레이어의 일별 집중 상태와 누적 집중 시간을 기록한다. 상태는 `FOCUSING` 또는 `RESTING`이며,
집중 시작/종료는 소켓 이벤트로 전파된다.

---

## 데이터 모델

`DailyFocusTime`은 하루에 하나의 레코드를 사용한다.

- `player_id`: 플레이어 ID
- `total_focus_minutes`: 누적 집중 시간(분)
- `status`: `FOCUSING` | `RESTING`
- `created_date`: `YYYY-MM-DD`
- `last_focus_start_time`: 마지막 집중 시작 시각 (nullable)

---

## 상태 전이

1. **방 입장**: `findOrCreate`로 당일 레코드 생성/조회
2. **focusing**: 상태를 `FOCUSING`으로 변경하고 `last_focus_start_time` 기록
3. **resting**: 집중 시간 누적 후 상태를 `RESTING`으로 변경
4. **disconnect**: `RESTING` 처리 시도 (예외는 로깅)

---

## 소켓 이벤트

### 클라이언트 → 서버

```typescript
socket.emit('focusing', { taskName?: string });  // taskName은 선택
socket.emit('resting');
```

### 서버 → 클라이언트

```typescript
socket.on('focused', (data: {
  userId: string,
  username: string,
  status: 'FOCUSING',
  lastFocusStartTime: string,
  totalFocusMinutes: number,
  taskName?: string
}) => {});

socket.on('rested', (data: {
  userId: string,
  username: string,
  status: 'RESTING',
  totalFocusMinutes: number
}) => {});
```

---

## 주의사항

- 방 입장 전에 `focusing/resting`을 호출하면 에러가 발생할 수 있다.
- `created_date`는 `YYYY-MM-DD` 문자열을 기준으로 조회한다.
