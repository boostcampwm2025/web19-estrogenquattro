# Issue #440: AI 코딩 에이전트용 문서 체계 구축 및 기존 문서 정리

## 관련 이슈

- #440: AI 코딩 에이전트용 문서 체계 구축 및 기존 문서 정리

---

## 목표

기존 사람용 문서(82개)를 에이전트 전용 압축 문서(7개)로 대체하고, CLAUDE.md를 에이전트의 실질적 진입점으로 강화한다. 계획(스펙) 문서(`docs/plan/`)는 유지한다.

---

## Phase 1: `docs/agent/` 디렉토리 신설

### 1-1. `ARCHITECTURE.md` — 전체 시스템 구조

**소스**: `architecture/OVERVIEW.md`, `BACKEND_MODULES.md`, `TECH_STACK.md`, `GAME_ENGINE.md`, `GAME_MANAGERS.md`, `STATE_MANAGEMENT.md`, `MAP_COORDINATES.md`

**포함할 내용**:
- 시스템 구성: Next.js 16 (SSG → backend/public) + NestJS 11 (포트 8080) + Socket.io + SQLite
- 백엔드 디렉토리 구조 — 모듈별 파일 경로 전체 트리
- 프론트엔드 디렉토리 구조 — stores, game/managers, scenes 파일 경로 전체 트리
- 프론트엔드 빌드: `output: 'export'`, `distDir: '../backend/public'`
- Phaser worldScale=2 좌표 변환 규칙
- Zustand 스토어 목록 및 역할
- 게임 매니저: MapManager, SocketManager, ChatManager 역할

**포맷**:
```markdown
## 시스템 구성
- Frontend: Next.js 16 (SSG) → `backend/public/`에서 서빙
- Backend: NestJS 11, 포트 8080
- DB: SQLite (`backend/data/jandi.sqlite`)
- 실시간: Socket.io 4.8

## 백엔드 파일 구조
backend/src/
├── auth/ — GitHub OAuth + JWT
├── player/ — 소켓 게이트웨이 + 플레이어 서비스
...

## 제약조건
- worldScale = 2: worldCoord = imageTiledCoord ÷ 2
- 프론트엔드 별도 서버 없음 (SSG 빌드 결과물을 NestJS가 서빙)
```

---

### 1-2. `SOCKET_EVENTS.md` — 소켓 이벤트 명세

**소스**: `api/SOCKET_EVENTS.md`

**포함할 내용**:
- 연결 설정: Socket.io 옵션 (`withCredentials: true`, JWT handshake)
- C→S 이벤트 테이블: 이벤트명, 페이로드 타입, 제약조건
- S→C 이벤트 테이블: 이벤트명, 페이로드 타입, 브로드캐스트 범위
- 핵심 페이로드 TypeScript 인터페이스
- `session_replaced` 흐름
- 연결 끊김 reason별 처리

**포맷**:
```markdown
## C→S 이벤트

### joining
- 페이로드: `{x: number, y: number, username: string}`
- 최초 연결 후 반드시 첫 번째로 emit
- 응답: joined, players_synced, game_state

### focusing
- 페이로드: `{taskName?: string, taskId?: number}`
- taskId 지정 시 해당 플레이어 소유 task여야 함
- 제약: RESTING 상태에서만 호출 가능
```

---

### 1-3. `REST_API.md` — REST 엔드포인트

**소스**: `api/REST_ENDPOINTS.md`

**포함할 내용**:
- 기본 URL: `/api/`
- 엔드포인트 테이블: Method, Path, Guard, Body/Query, Response 타입
- `/auth/me` 응답 구조 명시 (자주 틀리는 부분)
- 에러 응답 패턴

**포맷**:
```markdown
## 엔드포인트

| Method | Path | Body/Query | Response |
|--------|------|------------|----------|
| GET | /auth/me | - | {githubId, username, avatarUrl, playerId} |
| POST | /tasks | {description} | Task |
...

## 제약조건
- 모든 보호 라우트에 JwtGuard 적용 (httpOnly 쿠키)
- /auth/me 응답에 email, name 등은 없음 — githubId, username, avatarUrl, playerId만
```

---

### 1-4. `FOCUSTIME.md` — FocusTime 제약조건 + 코드 패턴

**소스**: `features/FOCUS_TIME.md`, `FOCUS_TIME_DETAIL.md`

**포함할 내용**:
- 상태 전이: RESTING ↔ FOCUSING (소켓 이벤트로만 전환)
- 시간 계산 규칙: 서버의 currentSessionSeconds 기준, 클라이언트는 표시용
- 자정 스케줄러: KST 00:00 (UTC 15:00), cron `0 0 15 * * *`
- DailyFocusTime 엔티티 스키마
- 관련 파일 경로 전체
- 코드 패턴: 올바른 시간 계산 예제
- 흔한 실수 목록

**포맷**:
```markdown
## 상태 전이
RESTING → focusing 이벤트 → FOCUSING
FOCUSING → resting 이벤트 → RESTING (시간 누적)
FOCUSING → 소켓 끊김 → 자동 RESTING 전환 (시간 누적)

## 시간 계산 (CRITICAL)
❌ let seconds = 0; setInterval(() => seconds++, 1000)
✅ serverCurrentSessionSeconds + (Date.now() - serverReceivedAt) / 1000

## 관련 파일
- 엔티티: backend/src/focustime/entities/daily-focus-time.entity.ts
- 서비스: backend/src/focustime/focustime.service.ts
- 게이트웨이: backend/src/focustime/focustime.gateway.ts
- 스케줄러: backend/src/focustime/focus-time-midnight.scheduler.ts
- 프론트엔드 스토어: frontend/src/stores/useFocusTimeStore.ts

## 흔한 실수
- ❌ duration을 클라이언트에서 계산해서 보내지 마세요
- ❌ startedAt을 new Date()로 설정하면 타임존 이슈 발생
```

---

### 1-5. `ENTITIES.md` — DB 엔티티 스키마 + 관계

**소스**: `guides/ERD.md`, `guides/DATABASE.md`, `guides/DOMAIN_GLOSSARY.md`

**포함할 내용**:
- 전체 엔티티 목록: 컬럼명, 타입, 제약조건
- FK 관계
- UK (Unique Key) 조합
- SQLite 특수 제약: DATE 타입 없음 → TEXT로 저장, ALTER TABLE 제한
- 날짜 컬럼 규칙: `created_date` = `YYYY-MM-DD` (string), datetime = `Date` 객체
- 도메인 용어 정의

**포맷**:
```markdown
## Player
| 컬럼 | 타입 | 제약 |
|------|------|------|
| id | INTEGER | PK, auto |
| social_id | VARCHAR | UK (GitHub ID) |
| nickname | VARCHAR | |
| equipped_pet_id | INTEGER | FK → Pet.id, nullable |
| total_point | INTEGER | default 0 |

## 관계
- Player 1:N DailyFocusTime (player_id)
- Player 1:N Task (player_id)
- Player 1:N UserPet (player_id)
...

## SQLite 제약
- ALTER TABLE로 컬럼 타입 변경 불가 → 마이그레이션 시 테이블 재생성 필요
- DATE 타입 없음 → TEXT로 저장, 포맷 'YYYY-MM-DD'
- DB 파일 경로: backend/data/jandi.sqlite (추측하지 말 것)
```

---

### 1-6. `GOTCHAS.md` — 자주 틀리는 것, 함정, 제약조건 모음

**소스**: Claude Code 인사이트 마찰 데이터 + 각 문서의 주의사항 + 실제 발생한 버그

**포함할 내용**:

```markdown
## DB
- SQLite는 ALTER TABLE로 컬럼 타입 변경 불가 → 테이블 재생성 필요
- DB 파일 경로: backend/data/jandi.sqlite (추측하지 말 것)
- date 컬럼은 TEXT 타입, 포맷 'YYYY-MM-DD' (UTC)

## Git & 배포
- deploy 브랜치 에러 → main 먼저 확인
- 프론트엔드 빌드 결과물: backend/public/ (커밋 대상 아님)
- 빌드: pnpm build:all (frontend SSG → backend/public/)

## 소켓
- 이벤트명 형식: player_joined (snake_case)
- ack 콜백 반드시 에러 처리 포함
- session_replaced: 같은 유저 새 탭 → 이전 탭 소켓 강제 종료

## 시간
- 자정 스케줄러: KST 00:00 = UTC 15:00, cron '0 0 15 * * *'
- 시간 계산은 서버 기준, 클라이언트는 표시용만
- 시즌 리셋: 매주 월요일 KST 00:00

## 인증
- /auth/me 응답: {githubId, username, avatarUrl, playerId} — 다른 필드 없음
- JWT + 쿠키 만료: 1일
- GitHub 콜백 URL 환경변수 필수

## GitHub 폴링
- 120초 간격 (30초 아님)
- REST Events API 사용 (GraphQL 아님)
- ETag 캐싱 필수 — 304는 rate limit 소모 안 함
- 첫 폴링은 baseline 설정용 — 이벤트 emit 하지 않음

## 좌표
- Phaser worldScale = 2: worldCoord = imageTiledCoord ÷ 2
- 맵 인덱스: 0~4 (5개)

## 포인트
- Gacha 비용: 100 포인트 (테스트 모드 0)
- Feed 비용: 10 포인트 (테스트 모드 0)

## 구현 원칙
- 계획 문서의 가장 단순한 접근법(Option 1) 우선
- 요청하지 않은 테스트 엔드포인트 추가 금지
- 문서화/조사 요청 시 코드 수정 금지
```

---

### 1-7. `PATTERNS.md` — 프로젝트 코드 패턴 가이드

**소스**: `guides/OPTIMISTIC_UPDATE.md`, `features/AUTH_FLOW.md`, `features/ROOM_JOIN_FLOW.md`, `features/PET_SYSTEM.md`, `features/POINT_SYSTEM.md`, `api/GITHUB_POLLING.md`

**포함할 내용**:
- Optimistic Update 패턴 (Zustand): 이전 상태 저장 → UI 즉시 반영 → 실패 시 롤백
- 인증 흐름: GitHub OAuth → JWT 쿠키 → /auth/me 검증
- 룸 입장 흐름: 소켓 연결 → joining → joined + players_synced + game_state
- 포인트 적립 규칙: 이벤트별 포인트 테이블
- 펫 시스템: Gacha → Feed → Evolve → Equip 흐름
- 맵 진행: 기여도 가중치 (Commit +2%, PR +5%), 맵 해금 임계값
- Remote Player Lerp 보간 패턴
- 소켓 이벤트 throttle (moving 30ms, map_switch 1s)
- E2E 플로우: 로그인 → 게임 입장 → 집중 → 휴식 → GitHub 커밋 → 진행도 업데이트

---

## Phase 2: CLAUDE.md 강화

### 변경할 내용

```markdown
## 절대 규칙
- /auth/me 응답: {githubId, username, avatarUrl, playerId} — 다른 필드 없음
- GitHub 폴링: REST Events API, 120초 간격 — GraphQL/30초 아님
- 프론트엔드는 SSG → backend/public에서 서빙
- DB: SQLite, 파일 경로 backend/data/jandi.sqlite
- 시간 계산은 서버 기준 (클라이언트 Date.now() 직접 사용 금지)

## 파일 수정 시 필독 문서
| 수정 대상 | 필독 문서 |
|-----------|-----------|
| backend/src/focustime/ | @docs/agent/FOCUSTIME.md |
| backend/src/socket/ 또는 *.gateway.ts | @docs/agent/SOCKET_EVENTS.md |
| backend/src/**/entities/ | @docs/agent/ENTITIES.md |
| frontend/src/stores/ | @docs/agent/PATTERNS.md |
| frontend/src/game/ | @docs/agent/ARCHITECTURE.md |
| REST 관련 controller/service | @docs/agent/REST_API.md |
| 처음 보는 코드 수정 시 | @docs/agent/GOTCHAS.md |

## 문서 참조
- **에이전트 문서**: @docs/agent/ (7개 파일)
- **계획 문서**: @docs/plan/ (이슈별 스펙/계획)

## 주의사항 (기존 유지 + 보강)
- GitHub 작업은 `gh` CLI 사용 (MCP 아님)
- 빌드/배포 실패 시 현재 브랜치 먼저 확인
- 계획 문서 기반 구현 시 가장 단순한 접근법 우선
- 문서화/조사 요청 시 코드 수정 금지
```

### 제거할 참조
- `@docs/architecture/OVERVIEW.md` → `@docs/agent/ARCHITECTURE.md`
- `@docs/api/SOCKET_EVENTS.md` → `@docs/agent/SOCKET_EVENTS.md`
- `@docs/api/REST_ENDPOINTS.md` → `@docs/agent/REST_API.md`
- 기타 기존 docs/ 참조 모두 agent/ 경로로 변경

---

## Phase 3: 기존 사람용 문서 제거

### 유지
- `docs/plan/` — 전체 유지 (계획/스펙 문서)
- `docs/plan/done/` — 전체 유지

### 제거

| 디렉토리 | 파일 수 | 대체 문서 |
|----------|---------|-----------|
| `docs/api/` | 4개 | agent/SOCKET_EVENTS.md, agent/REST_API.md |
| `docs/architecture/` | 7개 | agent/ARCHITECTURE.md |
| `docs/features/` | 6개 | agent/FOCUSTIME.md, agent/PATTERNS.md |
| `docs/guides/` | 7개 | agent/ENTITIES.md, agent/ARCHITECTURE.md, agent/GOTCHAS.md |
| `docs/conventions/` | 7개 | CLAUDE.md + agent/GOTCHAS.md |
| `docs/legacy/refactoring/fe/performance-optimization-calendar-heatmap.md` | 1개 | agent/PATTERNS.md |
| `docs/README.md` | 1개 | CLAUDE.md가 진입점 역할 |
| `docs/legacy/REST_API_REPORT.md` | 1개 | agent/REST_API.md |
| `docs/legacy/github-graphql-response-sample.json` | 1개 | 제거 (REST API로 전환됨) |

**총 제거: 35개 파일 (plan/ 제외)**

### CLAUDE.md 내 기존 경로 업데이트
- 모든 `@docs/api/`, `@docs/architecture/`, `@docs/features/`, `@docs/guides/`, `@docs/conventions/` 참조를 `@docs/agent/` 경로로 변경

---

## 작업 순서

1. **Phase 1** 먼저: `docs/agent/` 7개 파일 생성 (기존 문서 참조하며 작성)
2. **Phase 2**: CLAUDE.md 업데이트
3. **Phase 3**: 기존 문서 제거 + 경로 참조 정리
4. **검증**: 빌드 통과 확인, CLAUDE.md 참조 경로가 모두 유효한지 확인

---

## 에이전트 문서 작성 원칙

### DO
- 제약조건/규칙을 리스트로 나열
- 파일 경로를 정확히 명시
- 코드 패턴은 실제 프로젝트 코드 기반으로
- TypeScript 인터페이스로 페이로드 정의
- ❌/✅ 마커로 흔한 실수 명시

### DON'T
- 서사적 설명, 배경 맥락
- "왜 이렇게 설계했는지" 설명
- 온보딩 순서, 학습 경로
- 다이어그램 (에이전트는 텍스트 기반 검색)
- 중복 정보 (한 곳에만 기술)
