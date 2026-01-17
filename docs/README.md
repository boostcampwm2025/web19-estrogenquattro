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

### API (API 문서)

REST API 및 WebSocket 이벤트 명세

| 문서 | 설명 |
|------|------|
| [REST_ENDPOINTS.md](./api/REST_ENDPOINTS.md) | REST API 엔드포인트 |
| [SOCKET_EVENTS.md](./api/SOCKET_EVENTS.md) | Socket.io 이벤트 명세 |
| [GITHUB_POLLING.md](./api/GITHUB_POLLING.md) | GitHub GraphQL 폴링 |

### Guides (가이드)

개발 및 배포 가이드

| 문서 | 설명 |
|------|------|
| [DEVELOPMENT.md](./guides/DEVELOPMENT.md) | 개발 환경 설정 |
| [DEPLOYMENT.md](./guides/DEPLOYMENT.md) | 배포 가이드 |
| [DATABASE.md](./guides/DATABASE.md) | 데이터베이스 스키마 |

### Conventions (컨벤션)

팀 컨벤션 문서

| 문서 | 설명 |
|------|------|
| [BRANCH_STRATEGY.md](./conventions/BRANCH_STRATEGY.md) | 브랜치 전략 |
| [COMMIT_CONVENTION.md](./conventions/COMMIT_CONVENTION.md) | 커밋 컨벤션 |
| [PR_CONVENTION.md](./conventions/PR_CONVENTION.md) | PR 컨벤션 |
| [LOGGING_CONVENTION.md](./conventions/LOGGING_CONVENTION.md) | 로깅 컨벤션 |

### Reference (참고 자료)

시퀀스 다이어그램 및 참고 자료

| 문서 | 설명 |
|------|------|
| [AUTH_FLOW.md](./reference/AUTH_FLOW.md) | GitHub OAuth 인증 흐름 |
| [ENVIRONMENT.md](./reference/ENVIRONMENT.md) | 환경변수 목록 |

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
