# Issue #126: 누적 집중 시간 초 단위 변경

## 개요

| 항목 | 내용 |
|------|------|
| Issue | [#126](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/126) |
| 제목 | DB에 누적 집중 시간을 분 단위에서 초 단위로 변경 |
| 상태 | OPEN |

## 문제 상황

### 증상
- User A가 5분 30초 집중 후 휴식
- User A가 다시 집중 시작
- 다른 사용자는 User A의 시간을 5분으로 표시 (30초 손실)

### 원인
`focustime.service.ts:91-93`:
```typescript
const diffMs = now.getTime() - focusTime.lastFocusStartTime.getTime();
const diffMins = Math.floor(diffMs / 1000 / 60);  // 초가 버려짐
focusTime.totalFocusMinutes += diffMins;
```

`Math.floor`로 분 단위 내림 처리 시 초 단위가 손실됨.

### 영향 범위
- 다른 사용자가 보는 집중 시간 표시
- DB에 저장된 누적 시간 정확도

---

## 범위 정의

### 적용 대상
| 엔티티 | 적용 여부 | 사유 |
|--------|----------|------|
| `DailyFocusTime` | ✅ 적용 | 실시간 동기화 대상, 초 단위 정확도 필요 |
| `Task` | ❌ 제외 | 통계/기록 목적, 분 단위 충분 |

### 제외 사유 (Task)
- Task의 `totalFocusMinutes`는 완료된 작업의 누적 기록용
- 실시간 동기화 대상이 아님 (다른 사용자에게 전파되지 않음)
- 분 단위로 충분한 정밀도
- 추후 필요시 별도 이슈로 처리

### Task 제외가 합리적인 이유

| 관점 | DailyFocusTime | Task |
|------|----------------|------|
| **용도** | 실시간 동기화 | 기록/통계 |
| **정밀도 필요** | 초 단위 (실시간 표시) | 분 단위 (충분) |
| **다른 사용자에게 전파** | ✅ Yes | ❌ No |
| **초 손실 영향** | 치명적 (5:30 → 5:00) | 무시 가능 |

### Task 범위 불명확 시 발생 가능한 문제

| 문제 | 원인 | 시나리오 |
|------|------|----------|
| 단위 불일치 혼란 | 같은 "집중 시간"인데 단위가 다름 | Task에서 분, FocusTime에서 초 |
| 변환 오류 | 개발자가 단위 착각 | `task.totalFocusMinutes`를 초로 오해 |
| API 일관성 저하 | 비슷한 필드명에 다른 단위 | 프론트엔드 혼란 |

> **결론**: Task는 실시간 동기화 대상이 아니므로 이번 범위에서 제외. 문서에 단위 차이를 명시하여 혼란 방지.

---

## 해결 방안

### 핵심 변경
- `DailyFocusTime.totalFocusMinutes` → `totalFocusSeconds`
- 초 단위로 저장하여 손실 방지

---

## 기술적 고려사항

### 1. SQLite DROP COLUMN 문제

#### 문제 상황
```sql
ALTER TABLE daily_focus_time DROP COLUMN total_focus_minutes;
```

#### 발생 가능한 문제

| 문제 | 원인 | 발생 조건 |
|------|------|----------|
| `SQLITE_ERROR: near "DROP": syntax error` | SQLite 3.35.0 미만에서 `DROP COLUMN` 미지원 | 서버 SQLite 버전이 낮을 때 |
| 마이그레이션 실패 후 롤백 불가 | SQLite는 트랜잭션 내 DDL 부분 지원 | 마이그레이션 중간에 실패 시 |
| FK 제약조건 깨짐 | 컬럼 삭제 시 참조 무결성 검증 실패 | 외래키가 있는 테이블 |

#### 근본 원인
**버전 호환성** - SQLite 버전별 DDL 지원 차이

#### 해결: 테이블 재생성 방식
```
1. 새 테이블 생성 (새 스키마)
2. 데이터 복사 (변환 포함)
3. 기존 테이블 삭제
4. 새 테이블 이름 변경
```

**안전한 이유:**
- 모든 SQLite 버전에서 동작
- 각 단계가 원자적으로 실행
- 실패 시 기존 테이블 유지

---

### 2. 소켓 Payload Breaking Change

#### 문제 상황
```typescript
// 서버 변경 전
{ totalFocusMinutes: 5 }

// 서버 변경 후
{ totalFocusSeconds: 300 }
```

#### 발생 가능한 문제

| 방식 | 문제 | 원인 | 시나리오 |
|------|------|------|----------|
| **Coordinated Deploy** | 클라이언트 에러 | 서버 먼저 배포 시 구버전 클라이언트가 새 필드 인식 못함 | 사용자가 브라우저 새로고침 안 함 |
| **Coordinated Deploy** | 서버 에러 | 클라이언트 먼저 배포 시 서버가 구 필드 전송 | 서버 배포 지연 |
| **필드명만 변경** | `undefined` 참조 | `data.totalFocusMinutes`가 없어서 `NaN` 계산 | 구버전 클라이언트 |
| **필드명만 변경** | 시간 표시 오류 | 분/초 단위 혼동 (5분 vs 300초) | 필드명은 같은데 단위가 다를 때 |

#### 근본 원인
**배포 비동기성** - 서버/클라이언트 동시 배포 불가

#### 해결: Dual-Field 전략 (권장)

**Phase 1: 서버에서 양쪽 필드 전송**
```typescript
// 서버 응답 (하위 호환성 유지)
{
  totalFocusMinutes: Math.floor(totalFocusSeconds / 60),  // deprecated
  totalFocusSeconds: totalFocusSeconds,                    // new
}
```

**Phase 2: 클라이언트 업데이트**
```typescript
// 클라이언트에서 새 필드 우선 사용
const total = data.totalFocusSeconds ?? (data.totalFocusMinutes * 60);
```

**Phase 3: deprecated 필드 제거** (다음 릴리스)
- 서버에서 `totalFocusMinutes` 필드 제거
- 클라이언트 fallback 로직 제거

#### Dual-Field 호환성 매트릭스

| 상황 | 구버전 클라이언트 | 신버전 클라이언트 |
|------|------------------|------------------|
| 구버전 서버 | ✅ `totalFocusMinutes` 사용 | ✅ fallback으로 `totalFocusMinutes * 60` |
| 신버전 서버 | ✅ `totalFocusMinutes` 사용 | ✅ `totalFocusSeconds` 우선 사용 |

#### 왜 Dual-Field인가?
- Coordinated deploy는 서버/클라이언트 동시 배포 필요 → 위험
- Dual-field는 점진적 마이그레이션 가능 → 안전

---

### 3. 문서 업데이트 범위 누락

#### 문제 상황
```
SOCKET_EVENTS.md만 업데이트하고 다른 문서는 방치
```

#### 발생 가능한 문제

| 문제 | 원인 | 영향 |
|------|------|------|
| 문서-코드 불일치 | 여러 문서에 `totalFocusMinutes` 언급됨 | 개발자 혼란 |
| 잘못된 API 사용 | REST_ENDPOINTS.md가 구 필드 명시 | 클라이언트 개발 오류 |
| ERD 불일치 | DB 스키마 문서가 실제와 다름 | 신규 개발자 온보딩 지연 |
| 아키텍처 문서 오류 | GAME_ENGINE.md의 RemotePlayer 설명이 틀림 | 코드 이해도 저하 |

#### 근본 원인
**분산된 문서** - 같은 정보가 여러 곳에 중복

#### 해결: 영향받는 문서 전체 목록

| 파일 | 변경 내용 |
|------|----------|
| `docs/api/SOCKET_EVENTS.md` | 소켓 이벤트 필드 변경 |
| `docs/guides/ERD.md` | `daily_focus_time` 테이블 스키마 |
| `docs/guides/DATABASE.md` | 테이블 컬럼 설명 |
| `docs/reference/FOCUS_TIME.md` | FocusTime 데이터 모델 |
| `docs/api/REST_ENDPOINTS.md` | API 응답 필드 (해당시) |
| `docs/architecture/GAME_ENGINE.md` | RemotePlayer 옵션 설명 |

---

## 문제 원인 요약

| 문제 | 근본 원인 |
|------|----------|
| SQLite DROP COLUMN | **버전 호환성** - SQLite 버전별 DDL 지원 차이 |
| Payload Breaking Change | **배포 비동기성** - 서버/클라이언트 동시 배포 불가 |
| 문서 범위 누락 | **분산된 문서** - 같은 정보가 여러 곳에 중복 |
| Task 범위 | **도메인 경계 불명확** - "집중 시간"이 두 컨텍스트에 존재 |

---

## 구현 계획

### Phase 1: Backend 변경

#### 1.1 Entity 변경
**파일:** `backend/src/focustime/entites/daily-focus-time.entity.ts`

```typescript
// 변경 전
@Column({ default: 0 })
totalFocusMinutes: number;

// 변경 후
@Column({ default: 0 })
totalFocusSeconds: number;
```

#### 1.2 Service 변경
**파일:** `backend/src/focustime/focustime.service.ts`

```typescript
// 변경 전
const diffMins = Math.floor(diffMs / 1000 / 60);
focusTime.totalFocusMinutes += diffMins;

// 변경 후
const diffSecs = Math.floor(diffMs / 1000);
focusTime.totalFocusSeconds += diffSecs;
```

#### 1.3 Gateway 변경 (Dual-Field)
**파일:** `backend/src/focustime/focustime.gateway.ts`

```typescript
// focused 이벤트
client.to(roomId).emit('focused', {
  userId: client.id,
  username: focusTime.player.nickname,
  status: focusTime.status,
  lastFocusStartTime: focusTime.lastFocusStartTime?.toISOString() ?? null,
  // Dual-field: 하위 호환성
  totalFocusMinutes: Math.floor(focusTime.totalFocusSeconds / 60),
  totalFocusSeconds: focusTime.totalFocusSeconds,
  currentSessionSeconds,
  taskName: data?.taskName,
});

// rested 이벤트
client.to(roomId).emit('rested', {
  userId: client.id,
  username: focusTime.player.nickname,
  status: focusTime.status,
  // Dual-field
  totalFocusMinutes: Math.floor(focusTime.totalFocusSeconds / 60),
  totalFocusSeconds: focusTime.totalFocusSeconds,
});
```

#### 1.4 PlayerGateway 변경 (Dual-Field)
**파일:** `backend/src/player/player.gateway.ts`

`joined`, `players_synced`, `player_joined` 이벤트 모두 dual-field 적용:
```typescript
totalFocusMinutes: Math.floor(totalFocusSeconds / 60),  // deprecated
totalFocusSeconds: totalFocusSeconds,                    // new
```

#### 1.5 DB 마이그레이션 (SQLite 호환)

**전략: 테이블 재생성** (DROP COLUMN 미사용)

**파일:** `backend/src/database/migrations/XXXXXX-focus-time-seconds.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class FocusTimeSeconds1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 임시 테이블 생성 (새 스키마)
    await queryRunner.query(`
      CREATE TABLE daily_focus_time_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        total_focus_seconds INTEGER DEFAULT 0,
        status TEXT DEFAULT 'RESTING',
        created_date DATE NOT NULL,
        last_focus_start_time DATETIME,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )
    `);

    // 2. 데이터 마이그레이션 (분 → 초)
    await queryRunner.query(`
      INSERT INTO daily_focus_time_new
        (id, player_id, total_focus_seconds, status, created_date, last_focus_start_time)
      SELECT
        id, player_id, total_focus_minutes * 60, status, created_date, last_focus_start_time
      FROM daily_focus_time
    `);

    // 3. 기존 테이블 삭제
    await queryRunner.query(`DROP TABLE daily_focus_time`);

    // 4. 새 테이블 이름 변경
    await queryRunner.query(`
      ALTER TABLE daily_focus_time_new RENAME TO daily_focus_time
    `);

    // 5. 인덱스 재생성 (필요시)
    await queryRunner.query(`
      CREATE INDEX idx_focus_time_player_date
      ON daily_focus_time(player_id, created_date)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 롤백: 초 → 분 (역순)
    await queryRunner.query(`
      CREATE TABLE daily_focus_time_old (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        total_focus_minutes INTEGER DEFAULT 0,
        status TEXT DEFAULT 'RESTING',
        created_date DATE NOT NULL,
        last_focus_start_time DATETIME,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO daily_focus_time_old
        (id, player_id, total_focus_minutes, status, created_date, last_focus_start_time)
      SELECT
        id, player_id, total_focus_seconds / 60, status, created_date, last_focus_start_time
      FROM daily_focus_time
    `);

    await queryRunner.query(`DROP TABLE daily_focus_time`);
    await queryRunner.query(`
      ALTER TABLE daily_focus_time_old RENAME TO daily_focus_time
    `);
  }
}
```

### Phase 2: Frontend 변경

#### 2.1 Store 변경
**파일:** `frontend/src/stores/useFocusTimeStore.ts`

```typescript
// FocusTimeData 인터페이스 변경
export interface FocusTimeData {
  status: FocusStatus;
  totalFocusMinutes?: number;      // deprecated (하위 호환)
  totalFocusSeconds?: number;      // new
  currentSessionSeconds: number;
}

// syncFromServer 변경 (fallback 포함)
syncFromServer: (data: FocusTimeData) => {
  const isFocusing = data.status === "FOCUSING";
  // 새 필드 우선, 없으면 기존 필드 * 60
  const totalFocusSeconds = data.totalFocusSeconds
    ?? (data.totalFocusMinutes ?? 0) * 60;
  const totalSeconds =
    totalFocusSeconds +
    (isFocusing ? data.currentSessionSeconds : 0);
  // ...
}
```

#### 2.2 SocketManager 변경
**파일:** `frontend/src/game/managers/SocketManager.ts`

```typescript
// PlayerData 인터페이스 변경
interface PlayerData {
  // ...
  totalFocusMinutes?: number;  // deprecated
  totalFocusSeconds?: number;  // new
}

// addRemotePlayer에서 fallback 처리
const totalFocusSeconds = data.totalFocusSeconds
  ?? (data.totalFocusMinutes ?? 0) * 60;
```

#### 2.3 RemotePlayer 변경
**파일:** `frontend/src/game/players/RemotePlayer.ts`

```typescript
// 변경 전
this.totalFocusMinutes = options?.totalFocusMinutes ?? 0;
this.updateFocusTime(this.totalFocusMinutes * 60 + elapsed);

// 변경 후
this.totalFocusSeconds = options?.totalFocusSeconds
  ?? (options?.totalFocusMinutes ?? 0) * 60;
this.updateFocusTime(this.totalFocusSeconds + elapsed);
```

### Phase 3: 문서 업데이트

#### 변경 예시 (SOCKET_EVENTS.md)
```typescript
// 변경 전
totalFocusMinutes: number,

// 변경 후 (Phase 1: dual-field)
totalFocusMinutes: number,    // deprecated, 다음 버전에서 제거 예정
totalFocusSeconds: number,    // 누적 집중 시간 (초)

// 변경 후 (Phase 3: deprecated 제거)
totalFocusSeconds: number,
```

### Phase 4: 테스트

#### 4.1 Backend 테스트
- `focustime.service.spec.ts`: 초 단위 저장 검증
- `focustime.e2e-spec.ts`: 소켓 이벤트 dual-field 검증

#### 4.2 Frontend 테스트
- `socket-manager.spec.ts`: fallback 로직 테스트
  - `totalFocusSeconds` 있을 때
  - `totalFocusMinutes`만 있을 때 (하위 호환)

---

## PR 계획

### 현재 PR 스택
```
main
  ← fix/#120-focustime-bugs (PR #125)
      ← fix/#121-focustime-refresh (PR #134)
          ← fix/#122-focus-task-updated (PR #136)
```

### 새 브랜치
```
fix/#122-focus-task-updated (PR #136)
    ← fix/#126-focustime-seconds (새 PR)
```

### 브랜치 생성
```bash
git checkout fix/#122-focus-task-updated
git checkout -b fix/#126-focustime-seconds
```

### PR 정보
| 항목 | 내용 |
|------|------|
| 브랜치 | `fix/#126-focustime-seconds` |
| Base | `fix/#122-focus-task-updated` |
| 제목 | `fix: 누적 집중 시간 초 단위로 변경 (#126)` |

---

## 체크리스트

### Backend
- [ ] Entity 컬럼명 변경 (`totalFocusMinutes` → `totalFocusSeconds`)
- [ ] Service 계산 로직 변경 (분 → 초)
- [ ] FocusTimeGateway 이벤트 dual-field 적용
- [ ] PlayerGateway 이벤트 dual-field 적용
- [ ] DB 마이그레이션 작성 (테이블 재생성 방식)
- [ ] 테스트 수정

### Frontend
- [ ] `FocusTimeData` 인터페이스 변경 (optional fields)
- [ ] `useFocusTimeStore` fallback 로직 추가
- [ ] `SocketManager` fallback 로직 추가
- [ ] `RemotePlayer` fallback 로직 추가
- [ ] 테스트 수정

### 문서
- [ ] `docs/api/SOCKET_EVENTS.md`
- [ ] `docs/guides/ERD.md`
- [ ] `docs/guides/DATABASE.md`
- [ ] `docs/reference/FOCUS_TIME.md`
- [ ] `docs/api/REST_ENDPOINTS.md` (해당시)
- [ ] `docs/architecture/GAME_ENGINE.md`

### CI
- [ ] Backend lint/format/build/test 통과
- [ ] Frontend lint/format/build/test 통과

---

## 배포 타임라인

| Phase | 내용 | 예상 |
|-------|------|------|
| Phase 1 | Backend dual-field + DB 마이그레이션 | 1일차 |
| Phase 2 | Frontend 새 필드 사용 + fallback | 1일차 |
| Phase 3 | deprecated 필드 제거 | 다음 릴리스 |

---

## FAQ

### Q: Task의 totalFocusMinutes는 왜 변경 안 하나요?
A: Task는 완료된 작업의 기록용이며 실시간 동기화 대상이 아닙니다. 분 단위로 충분합니다.

### Q: SQLite DROP COLUMN이 안 되면 어떻게 하나요?
A: 테이블 재생성 방식으로 마이그레이션합니다. (임시 테이블 생성 → 데이터 복사 → 기존 테이블 삭제 → 이름 변경)

### Q: 배포 중 클라이언트가 구버전이면?
A: Dual-field 전략으로 구버전 클라이언트도 `totalFocusMinutes` 필드를 받을 수 있습니다.

### Q: 왜 Coordinated Deploy가 아닌 Dual-Field인가요?
A: Coordinated Deploy는 서버/클라이언트 동시 배포가 필요하여 위험합니다. 사용자가 브라우저를 새로고침하지 않으면 구버전 클라이언트가 유지되므로, Dual-field로 점진적 마이그레이션이 안전합니다.

### Q: 문서를 왜 6개나 수정해야 하나요?
A: `totalFocusMinutes`가 여러 문서에 분산되어 언급되어 있습니다. 코드-문서 불일치를 방지하기 위해 모두 업데이트해야 합니다.

---

## 참고 사항

- 기존 DB 데이터는 마이그레이션으로 자동 변환 (분 * 60 = 초)
- 소켓 이벤트 빈도 변경 없음 (성능 영향 없음)
- 실시간 표시는 여전히 클라이언트 로컬 계산
- Task 엔티티는 이번 범위에서 제외 (별도 이슈로 처리)
