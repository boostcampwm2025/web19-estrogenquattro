# API_REST_CARD

## When To Load

- REST API 엔드포인트/DTO/Controller 구현 질문
- 특정 API 경로의 실제 구현 파일 추적 질문

## Primary Sources (Order)

1. `backend/src/**/*.controller.ts` (구현 원본)
2. `docs/api/REST_ENDPOINTS.md` (상세 명세)
3. `docs/api/PET_EVENTS.md` (펫 API 보강)

## Fast Mapping

- 인증: `backend/src/auth/auth.controller.ts`
- 플레이어: `backend/src/player/player.controller.ts`
- 태스크: `backend/src/task/task.controller.ts`
- 포커스 타임: `backend/src/focustime/focustime.controller.ts`
- GitHub: `backend/src/github/github.controller.ts`, `backend/src/github/map.controller.ts`
- 방: `backend/src/room/room.controller.ts`
- 포인트: `backend/src/point/point.controller.ts`, `backend/src/pointhistory/point-history.controller.ts`
- 펫: `backend/src/userpet/pet.controller.ts`

## Retrieval Guidance

- 카드 사용 후에도 모호하면 컨트롤러 코드 우선
- 과거 설계 맥락은 기본 제외 (`docs/plan/**`)

## Sources

- `docs/api/REST_ENDPOINTS.md`
- `docs/api/PET_EVENTS.md`
- `docs/README.md`
