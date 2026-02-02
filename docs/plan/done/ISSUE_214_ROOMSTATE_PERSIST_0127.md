# Issue #214: 서버 재시작 시 프로그레스/기여도 초기화

> 2026-01-27 작성

## 참조한 문서

- [GITHUB_POLLING.md](../api/GITHUB_POLLING.md): roomStates 구조 및 프로그레스 계산
- [SOCKET_EVENTS.md](../api/SOCKET_EVENTS.md): github_state 이벤트 (입장 시 전송)
- [ERD.md](../guides/ERD.md): daily_github_activity 테이블 구조

## 이슈 요약

- **문제**: 서버 재시작(pm2 restart, 배포) 시 프로그레스바/기여도가 0으로 리셋됨
- **원인**: `roomStates`가 메모리에만 저장, 영속화 없음

## 현재 구조

```typescript
// backend/src/github/github.gateway.ts:25
private roomStates = new Map<string, RoomGithubState>();

interface RoomGithubState {
  progress: number;                      // 0-99
  contributions: Record<string, number>; // username -> 총 기여 수
}
```

**문제점:**
- 서버 재시작 시 `roomStates` Map 초기화 → 모든 방 상태 손실
- DB에 `daily_github_activity` 저장되지만 복원 로직 없음

## 변경 계획

### 방향 1: DB 영속화 (daily_github_activity 활용)

기존 테이블을 활용하여 서버 시작 시 복원

```typescript
// 서버 시작 시 (OnModuleInit)
async onModuleInit() {
  // daily_github_activity에서 오늘 날짜 데이터 조회
  // roomStates 복원 (단, roomId 정보가 없어 한계 있음)
}
```

**한계:**
- `daily_github_activity`에 roomId 없음
- 방별 프로그레스 복원 불가

### 방향 2: room_state 테이블 신규 생성

```sql
CREATE TABLE room_state (
  id INTEGER PRIMARY KEY,
  room_id VARCHAR(50) UNIQUE NOT NULL,
  progress INTEGER DEFAULT 0,
  contributions TEXT,  -- JSON: {"username": count}
  updated_at DATETIME
);
```

**장점:**
- 방별 상태 완전 복원 가능
- 서버 시작 시 모든 방 상태 로드

**단점:**
- 신규 테이블 + 마이그레이션 필요
- github_event 발생마다 DB 쓰기 (성능 고려 필요)

### 방향 3: Redis 캐시 (권장)

```typescript
// Redis에 방 상태 저장
await redis.hset(`room:${roomId}:state`, {
  progress: state.progress,
  contributions: JSON.stringify(state.contributions)
});

// 서버 시작 시 복원
const keys = await redis.keys('room:*:state');
for (const key of keys) {
  const state = await redis.hgetall(key);
  // roomStates에 복원
}
```

**장점:**
- 빠른 읽기/쓰기
- TTL 설정으로 오래된 방 자동 정리

**단점:**
- Redis 인프라 추가 필요

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/github/github.gateway.ts` | roomStates 영속화 로직 추가 |
| `backend/src/database/entities/` | (방향2) RoomState 엔티티 추가 |
| `backend/src/database/migrations/` | (방향2) 마이그레이션 파일 |

## 브랜치

`fix/#214-roomstate-persist`

## 작업 순서

1. 방향 결정 (팀 논의 필요)
   - DB vs Redis
   - 방향2 선택 시 마이그레이션 계획
2. 영속화 로직 구현
3. 서버 시작 시 복원 로직 구현
4. 테스트 (서버 재시작 후 상태 유지 확인)

## 참고

- 현재 인프라에 Redis가 없으면 방향2(DB) 선택
- 방향2 선택 시 쓰기 최적화 고려 (debounce, batch write)
