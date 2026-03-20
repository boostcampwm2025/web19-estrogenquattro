# Codex Working Guide

이 저장소에서 Codex가 작업할 때는 아래 규칙을 우선 적용합니다.

## 1. 이슈 기준으로 작업

- 기능 작업은 `.github/ISSUE_TEMPLATE/feature.yml` 구조를 기준으로 범위, 완료 조건, 완수 테스트, 회귀 테스트를 먼저 고정합니다.
- 버그 수정은 `.github/ISSUE_TEMPLATE/bug.yml` 구조를 기준으로 문제 현상, 재현 절차, 기대 동작, 실제 동작, 영향 범위를 먼저 정리합니다.
- 이슈가 없거나 정보가 비어 있으면, 바로 구현을 넓히지 말고 작업 범위와 검증 기준부터 명확히 맞춥니다.

## 2. 브랜치 컨벤션

- 브랜치 이름은 `docs/conventions/BRANCH_STRATEGY.md`를 따릅니다.
- 작업 브랜치 형식은 `{type}/#이슈번호-작업내용` 입니다.
- 예시:
  - `feat/#123-login`
  - `fix/#456-oauth-timeout`
  - `docs/#789-readme-update`
- 브랜치 타입은 `feat`, `fix`, `refactor`, `docs`, `test`, `setting`, `chore`만 사용합니다.
- PR의 base branch는 현재 저장소 운영 상태와 PR 문맥을 먼저 확인하고 맞춥니다. 관성적으로 임의의 base branch를 정하지 않습니다.

## 3. 커밋 규칙

- 커밋은 반드시 원자적으로 나눕니다. 하나의 커밋에는 하나의 논리적 변경만 포함합니다.
- 기능 추가와 리팩터링, 기능 수정과 포맷팅, 로직 변경과 문서 수정이 서로 독립적이면 커밋도 분리합니다.
- 각 커밋은 개별적으로 리뷰 가능하고, 필요하면 안전하게 revert 가능해야 합니다.
- 커밋 메시지는 `docs/conventions/COMMIT_CONVENTION.md`를 따릅니다.
- 형식은 `{type}: {설명}` 이고, 설명은 한글로 작성합니다.
- 허용 타입은 `feat`, `fix`, `style`, `refactor`, `docs`, `test`, `setting`, `chore` 입니다.

## 4. PR 규칙

- PR은 하나의 기능 또는 하나의 버그 단위로 엽니다.
- PR 제목/본문은 `.github/pull_request_template.md`와 `docs/conventions/PR_CONVENTION.md`를 따릅니다.
- PR 본문에는 최소한 아래 내용을 포함합니다.
  - 관련 이슈
  - 작업 내용
  - 검증 내용 또는 테스트 결과
  - 리뷰어가 꼭 봐야 할 포인트
- PR에 무관한 변경은 섞지 않습니다. 큰 작업이면 PR도 논리 단위로 분리합니다.

## 5. 마이그레이션 파일 금지

- 자동 생성되었거나 임시로 만든 마이그레이션 파일은 커밋에 포함하지 않습니다.
- 특히 `backend/src/database/migrations/` 아래 파일은 사용자 요청이 명시적으로 없는 한 생성, 수정, 커밋하지 않습니다.
- 스키마 변경이 필요한 작업이라도 먼저 사용자 의도를 확인하고, 승인 없이 migration 파일을 추가하지 않습니다.

## 6. 추가 작업 원칙

- 테스트를 건드린 변경은 가능한 범위에서 관련 테스트를 함께 추가하거나 갱신합니다.
- 문서에 영향을 주는 변경은 최소한 관련 문서를 함께 동기화할지 확인합니다.
- 사용자가 만든 기존 변경은 되돌리지 않습니다. 내 작업과 충돌할 때만 명시적으로 판단합니다.
- 비밀값, 토큰, 실제 운영용 `.env` 값은 출력하거나 커밋하지 않습니다.
- 대규모 리팩터링, 스키마 변경, 배포 설정 변경처럼 영향 범위가 큰 작업은 바로 확장하지 말고 범위를 먼저 고정합니다.

## 7. 추천하는 추가 습관

- 구현 전에 "완료 조건"과 "회귀 확인 방법"을 짧게 적고 시작합니다.
- 변경 후에는 실행한 테스트, 못 돌린 테스트, 남은 리스크를 분명히 남깁니다.
- 프론트와 백을 함께 건드릴 때는 API 계약, 타입, 문서를 한 번에 맞춥니다.

## Sources

- `.github/ISSUE_TEMPLATE/feature.yml`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/pull_request_template.md`
- `docs/conventions/BRANCH_STRATEGY.md`
- `docs/conventions/COMMIT_CONVENTION.md`
- `docs/conventions/PR_CONVENTION.md`
