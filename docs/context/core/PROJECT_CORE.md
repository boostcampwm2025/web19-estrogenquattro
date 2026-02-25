# PROJECT_CORE

## Purpose

LLM이 작업 시작 전에 알아야 하는 프로젝트 전역 컨텍스트만 압축 제공합니다.

## Core Invariants

- 모노레포 구조: `backend/`(NestJS), `frontend/`(Next.js + Phaser), `docs/`
- 런타임: 프론트 정적 빌드 결과를 `backend/public`에서 서빙
- 실시간 동기화 채널: Socket.io 이벤트 중심
- 인증: GitHub OAuth2 + JWT(httpOnly 쿠키)

## Default Loading Order

1. `docs/README.md`
2. `docs/context/core/PROJECT_CORE.md`
3. `docs/architecture/OVERVIEW.md`
4. `docs/guides/DOMAIN_GLOSSARY.md`

## Module Expansion Rules

- API/Controller 질문: `docs/context/modules/API_REST_CARD.md` 먼저
- Socket/Gateway 질문: `docs/context/modules/SOCKET_EVENTS_CARD.md` 먼저
- GitHub 폴링/프로그레스 질문: `docs/context/modules/GITHUB_POLLING_CARD.md` 먼저
- 카드로 부족할 때만 원문(`docs/api/*`) 확장

## Default Exclusions

- `docs/plan/**`
- `docs/legacy/**`

## Sources

- `docs/README.md`
- `docs/context-manifest.yaml`
