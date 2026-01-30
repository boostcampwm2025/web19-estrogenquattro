# EstrogenQuattro 문서

GitHub 활동 기반 멀티플레이어 게이미피케이션 서비스

## 문서 구조

### Architecture (아키텍처)

프로젝트 구조와 기술적 설계에 대한 문서

| 문서 | 설명 |
|------|------|
| [OVERVIEW.md](./architecture/OVERVIEW.md) | 프로젝트 전체 구조 |
| [TECH_STACK.md](./architecture/TECH_STACK.md) | 기술 스택 |
| [GAME_ENGINE.md](./architecture/GAME_ENGINE.md) | Phaser 게임 엔진 구조 |
| [GAME_MANAGERS.md](./architecture/GAME_MANAGERS.md) | 게임 매니저/컨트롤러 |
| [MAP_COORDINATES.md](./architecture/MAP_COORDINATES.md) | 맵 스케일링과 좌표 시스템 |
| [STATE_MANAGEMENT.md](./architecture/STATE_MANAGEMENT.md) | 프론트엔드 상태 관리 (Zustand) |
| [BACKEND_MODULES.md](./architecture/BACKEND_MODULES.md) | 백엔드 모듈 구조 (NestJS) |

### API (API 문서)

REST API 및 WebSocket 이벤트 명세

| 문서 | 설명 |
|------|------|
| [REST_ENDPOINTS.md](./api/REST_ENDPOINTS.md) | REST API 엔드포인트 |
| [SOCKET_EVENTS.md](./api/SOCKET_EVENTS.md) | Socket.io 이벤트 명세 |
| [GITHUB_POLLING.md](./api/GITHUB_POLLING.md) | GitHub GraphQL 폴링 |

### Features (기능 문서)

각 기능의 상세 설명 및 시퀀스 다이어그램

| 문서 | 설명 |
|------|------|
| [AUTH_FLOW.md](./features/AUTH_FLOW.md) | GitHub OAuth 인증 흐름 |
| [FOCUS_TIME.md](./features/FOCUS_TIME.md) | 포커스 타임 개요 |
| [FOCUS_TIME_DETAIL.md](./features/FOCUS_TIME_DETAIL.md) | 포커스 타임 구현 상세 |
| [ROOM_JOIN_FLOW.md](./features/ROOM_JOIN_FLOW.md) | 방 입장 및 게임 시작 흐름 |
| [PET_SYSTEM.md](./features/PET_SYSTEM.md) | 펫 시스템 (가챠, 진화, 장착) |
| [POINT_SYSTEM.md](./features/POINT_SYSTEM.md) | 포인트 시스템 |

### Guides (가이드)

개발 및 배포 가이드

| 문서 | 설명 |
|------|------|
| [DEVELOPMENT.md](./guides/DEVELOPMENT.md) | 개발 환경 설정 |
| [DEPLOYMENT.md](./guides/DEPLOYMENT.md) | 배포 가이드 |
| [DATABASE.md](./guides/DATABASE.md) | 데이터베이스 가이드 |
| [ERD.md](./guides/ERD.md) | ERD 및 테이블 상세 |
| [ENVIRONMENT.md](./guides/ENVIRONMENT.md) | 환경변수 목록 |
| [DOMAIN_GLOSSARY.md](./guides/DOMAIN_GLOSSARY.md) | 도메인 용어집 |
| [OPTIMISTIC_UPDATE.md](./guides/OPTIMISTIC_UPDATE.md) | 낙관적 업데이트 패턴 |

### Conventions (컨벤션)

팀 컨벤션 문서

| 문서 | 설명 |
|------|------|
| [BRANCH_STRATEGY.md](./conventions/BRANCH_STRATEGY.md) | 브랜치 전략 |
| [COMMIT_CONVENTION.md](./conventions/COMMIT_CONVENTION.md) | 커밋 컨벤션 |
| [PR_CONVENTION.md](./conventions/PR_CONVENTION.md) | PR 컨벤션 |
| [LOGGING_CONVENTION.md](./conventions/LOGGING_CONVENTION.md) | 로깅 컨벤션 |
| [TEST_CONVENTION.md](./conventions/TEST_CONVENTION.md) | 테스트 컨벤션 |
| [MARKDOWN_CONVENTION.md](./conventions/MARKDOWN_CONVENTION.md) | 마크다운 컨벤션 |

---

## 신규 개발자 온보딩 경로

1. **README.md** (현재 문서) - 전체 구조 파악
2. **[OVERVIEW.md](./architecture/OVERVIEW.md)** - 시스템 이해
3. **[DOMAIN_GLOSSARY.md](./guides/DOMAIN_GLOSSARY.md)** - 도메인 용어 이해
4. **[DEVELOPMENT.md](./guides/DEVELOPMENT.md)** - 환경 설정
5. 역할별 선택:
   - 프론트엔드: [STATE_MANAGEMENT.md](./architecture/STATE_MANAGEMENT.md) → [GAME_MANAGERS.md](./architecture/GAME_MANAGERS.md)
   - 백엔드: [BACKEND_MODULES.md](./architecture/BACKEND_MODULES.md) → [ERD.md](./guides/ERD.md)
6. 기능별 문서 (Features) 참조

---

## 빠른 시작

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev

# 빌드
pnpm build
```

자세한 내용은 [DEVELOPMENT.md](./guides/DEVELOPMENT.md) 참고

---

## 코드-문서 매핑

`/sync-docs` 명령어가 참조하는 매핑 테이블입니다.

| 코드 경로 | 관련 문서 |
|-----------|----------|
| `backend/src/auth/` | `docs/features/AUTH_FLOW.md` |
| `backend/src/focustime/` | `docs/features/FOCUS_TIME.md`, `docs/features/FOCUS_TIME_DETAIL.md` |
| `backend/src/task/` | `docs/api/REST_ENDPOINTS.md` |
| `backend/src/github/` | `docs/api/GITHUB_POLLING.md` |
| `backend/src/player/` | `docs/api/SOCKET_EVENTS.md` |
| `backend/src/room/` | `docs/features/ROOM_JOIN_FLOW.md` |
| `backend/src/userpet/` | `docs/features/PET_SYSTEM.md` |
| `backend/src/point/` | `docs/features/POINT_SYSTEM.md` |
| `backend/src/database/` | `docs/guides/ERD.md`, `docs/guides/DATABASE.md` |
| `frontend/src/lib/socket.ts` | `docs/api/SOCKET_EVENTS.md` |
| `frontend/src/game/` | `docs/architecture/GAME_ENGINE.md` |
| `frontend/src/game/scenes/` | `docs/architecture/GAME_ENGINE.md` |
| `frontend/src/game/managers/` | `docs/architecture/GAME_MANAGERS.md` |
| `frontend/src/stores/` | `docs/architecture/STATE_MANAGEMENT.md` |
| `*.entity.ts` | `docs/guides/ERD.md` |
| `*.gateway.ts` | `docs/api/SOCKET_EVENTS.md` |
| `*.controller.ts` | `docs/api/REST_ENDPOINTS.md` |
| `backend/src/scheduler/` | `docs/architecture/BACKEND_MODULES.md` |
| `backend/src/pointhistory/` | `docs/features/POINT_SYSTEM.md`, `docs/api/REST_ENDPOINTS.md` |

> 새 모듈/기능 추가 시 이 테이블도 함께 업데이트하세요.

---

## 문서 동기화 현황

| 항목 | 마지막 동기화 | 커밋 |
|------|-------------|------|
| 전체 문서 | 2026-01-29 | [`8dd241f`](https://github.com/boostcampwm2025/web19-estrogenquattro/commit/8dd241f) |

> 문서와 코드 불일치 발견 시 이슈로 등록해주세요.
