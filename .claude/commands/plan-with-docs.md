# 문서 기반 계획 수립

문제 해결 또는 기능 구현 계획 수립 시 관련 문서를 먼저 참조합니다.

## 1단계: 작업 영역 파악

사용자 요청을 분석하여 관련 영역을 파악합니다:
- 게임/Phaser 관련
- 소켓 이벤트 관련
- REST API 관련
- 포커스 타임 관련
- 인증 관련
- DB/엔티티 관련
- 펫 시스템 관련
- 포인트 시스템 관련

## 2단계: 관련 문서 읽기

아래 매핑 테이블을 참고하여 관련 문서를 **반드시** 읽습니다:

| 작업 영역 | 필수 참조 문서 |
|----------|---------------|
| 게임/Phaser | `docs/architecture/GAME_ENGINE.md`, `docs/architecture/GAME_MANAGERS.md` |
| 소켓 이벤트 | `docs/api/SOCKET_EVENTS.md` |
| REST API | `docs/api/REST_ENDPOINTS.md` |
| 포커스 타임 | `docs/features/FOCUS_TIME.md`, `docs/features/FOCUS_TIME_DETAIL.md` |
| 인증 | `docs/features/AUTH_FLOW.md` |
| DB/엔티티 | `docs/guides/ERD.md`, `docs/guides/DATABASE.md` |
| 펫 시스템 | `docs/features/PET_SYSTEM.md` |
| 포인트 시스템 | `docs/features/POINT_SYSTEM.md` |
| 방 입장 | `docs/features/ROOM_JOIN_FLOW.md` |
| GitHub 폴링 | `docs/api/GITHUB_POLLING.md` |
| 상태 관리 | `docs/architecture/STATE_MANAGEMENT.md` |
| 백엔드 모듈 | `docs/architecture/BACKEND_MODULES.md` |

### 코드-문서 매핑

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
| `frontend/src/game/` | `docs/architecture/GAME_ENGINE.md` |
| `frontend/src/game/managers/` | `docs/architecture/GAME_MANAGERS.md` |
| `frontend/src/stores/` | `docs/architecture/STATE_MANAGEMENT.md` |
| `*.entity.ts` | `docs/guides/ERD.md` |
| `*.gateway.ts` | `docs/api/SOCKET_EVENTS.md` |
| `*.controller.ts` | `docs/api/REST_ENDPOINTS.md` |

## 3단계: 계획 수립

문서 내용을 기반으로 계획을 작성합니다:

1. **현재 구조 요약** - 문서에서 파악한 현재 아키텍처/흐름
2. **변경 필요 사항** - 문제 해결 또는 기능 구현에 필요한 변경점
3. **수정 대상 파일** - 변경이 필요한 파일 목록
4. **구현 순서** - 의존성을 고려한 작업 순서
5. **테스트 계획** - 검증 방법

## 4단계: 계획 출력

아래 형식으로 계획을 출력합니다:

```markdown
## 참조한 문서
- [문서명](경로): 참조 이유

## 현재 구조
(문서에서 파악한 관련 아키텍처 요약)

## 변경 계획
1. (작업 1)
2. (작업 2)
...

## 수정 대상 파일
- `파일경로`: 변경 내용

## 테스트 계획
- (검증 방법)
```

## 계획 문서 네이밍 규칙

`docs/plan/` 폴더에 계획 문서를 생성할 때 아래 규칙을 따릅니다:

**형식:** `{설명}_{MMDD}.md`

- **설명**: 이슈 관련 시 `ISSUE_{번호}_{설명}` 형식
- **날짜**: 년도 제외, 월일만 (MMDD), 파일명 맨 뒤에 배치

**예시:**
- `ISSUE_217_CHAT_BUBBLE_TAB_0124.md`
- `WEEKEND_BUGS_0123.md`
- `BROWSER_TEST_PLAN_0122.md`

**완료 시:** `docs/plan/done/` 폴더로 이동

## 브랜치 네이밍 규칙

계획 문서에 브랜치 이름을 포함할 때 아래 컨벤션을 따릅니다:

**형식:** `{타입}/#이슈번호-작업내용`

| 타입 | 설명 | 예시 |
|------|------|------|
| feat | 새로운 기능 추가 | `feat/#12-login` |
| fix | 버그 수정 | `fix/#217-chat-bubble-tab` |
| refactor | 코드 리팩토링 | `refactor/#56-api-client` |
| docs | 문서 작업 | `docs/#78-readme` |
| test | 테스트 코드 | `test/#90-unit-test` |
| setting | 환경 설정 | `setting/#18-ci-setup` |
| chore | 기타 작업 | `chore/#11-cleanup` |
