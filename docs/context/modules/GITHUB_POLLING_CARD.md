# GITHUB_POLLING_CARD

## When To Load

- GitHub 이벤트 폴링, ETag, 기준점, 포인트 반영 흐름 질문
- progress/contributions 갱신 경로 추적 질문

## Primary Sources (Order)

1. `backend/src/github/github.poll-service.ts`
2. `backend/src/github/progress.gateway.ts`
3. `docs/api/GITHUB_POLLING.md`

## Core Pipeline

1. 사용자 join 시 폴링 스케줄 등록
2. GitHub REST Events 요청(ETag 조건부)
3. 새 이벤트 감지 시 DB/포인트 반영
4. Gateway가 `progress_update`/맵 전환 이벤트 브로드캐스트

## Retrieval Guidance

- 간격/백오프/기준점 로직은 `github.poll-service.ts`를 우선 참조
- 이벤트 브로드캐스트 형태는 `progress.gateway.ts`를 우선 참조
- 과거 실험/이행 문서(`docs/legacy/*`, `docs/plan/*`)는 기본 제외

## Sources

- `docs/api/GITHUB_POLLING.md`
- `docs/context-manifest.yaml`
