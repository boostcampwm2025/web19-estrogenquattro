# ISSUE #476 feat: 채팅/태스크 글자수 제한을 바이트 기반으로 변경 (영어 글자수 제한 완화)

## 메타 정보
- Issue URL: https://github.com/boostcampwm2025/web19-estrogenquattro/issues/476
- Issue 번호: 476
- 기준 브랜치: dev
- 작업 브랜치: issue-476-feat
- 브랜치 네이밍 예외 확인: 컨벤션(`{타입}/#이슈번호-작업내용`) 대비 예외 여부 PR에서 확인 필요
- Worktree 경로: /home/fpg123/Workspace/boost/web19-estrogenquattro/.worktrees/issue-476-feat
- 작성일: 2026-02-22

## 배경/문제
현재 채팅/태스크 입력 길이 제한이 문자 수 기준이라 한글 대비 영어 입력 시 동일 제한에서 체감 입력 가능량이 크게 줄어드는 문제가 있습니다.
채팅(백엔드/프론트), 태스크 설명, 말풍선 태스크명 제한이 서로 분산되어 있어 규칙이 불일치할 위험도 있습니다.
이슈 요구사항은 바이트 기반(UTF-8) 또는 동등한 사용자 경험을 주는 제한 방식으로 변경해 영어 입력 제한을 완화하는 것입니다.

## 목표
- [ ] 채팅/태스크 텍스트 길이 검증 기준을 바이트 기반(또는 합의된 대안)으로 통일한다.
- [ ] 백엔드와 프론트엔드의 입력 제한 및 검증 로직을 동기화한다.

## 범위
### 포함
- 채팅 길이 제한 상수(`CHAT_MAX_LENGTH`) 및 프론트 입력 제한 업데이트
- 태스크 설명(`MAX_TASK_TEXT_LENGTH`) 제한 로직 업데이트
- 말풍선 태스크명(`MAX_TASK_NAME_LENGTH`) 표시/검증 제한 업데이트
- 포커스 태스크명 소켓 payload(`focusing`, `focus_task_updating`) 검증/정규화 동기화
- 한글/영어 혼합 문자열 기준 검증 케이스 추가
- 로케일 에러 문구(`taskTooLong`) 및 길이 정책 고정 문구 업데이트
- 길이 정책 관련 문서(ERD/용어집/모듈 문서) 동기화

### 제외
- 채팅/태스크 UI 디자인 변경
- GitHub 활동, 포인트, 방 로직 등 길이 제한 외 기능 수정

## 구현 단계
1. [ ] 분석 및 재현
   - 현재 문자 수 기준 적용 지점(채팅/태스크/말풍선/포커스 소켓 payload) 전수 확인
   - 제한 정책 수치(채팅/태스크/태스크명 바이트 상한) 확정
2. [ ] 구현
   - 프론트/백엔드 바이트 계산 기준(`TextEncoder`/`Buffer.byteLength`) 공통 정책으로 반영
   - 채팅/태스크/포커스 태스크명 검증 및 입력 처리 로직 업데이트
3. [ ] 테스트
   - 단위/통합/E2E 테스트에 한글/영어/혼합 문자열 경계 케이스 추가
   - 프론트-백엔드 동일 계산 결과를 검증하는 계약 테스트 추가
4. [ ] 문서화/정리
   - API/아키텍처/가이드 문서와 로케일 문구를 최종 정책 기준으로 동기화

## 문서 동기화 대상
- `docs/api/SOCKET_EVENTS.md`: `chatting` 메시지 제한(현재 30자)을 최종 정책(바이트 기준 또는 합의 대안)으로 갱신
- `docs/api/REST_ENDPOINTS.md`: Task `description` 입력 제한 정책(검증 기준, 실패 처리)을 명시
- `docs/architecture/GAME_ENGINE.md`: `frontend/src/game/` 내 말풍선 태스크명 제한 처리 변경 시 반영 여부 점검
- `docs/guides/ERD.md`: Task description 제약(100자 표기)을 바이트 정책 기준으로 동기화
- `docs/guides/DOMAIN_GLOSSARY.md`: Task 설명 길이 항목을 최종 바이트 정책으로 업데이트
- `docs/architecture/BACKEND_MODULES.md`: Task 엔티티 설명 제한 문구를 최종 정책으로 업데이트

## 리스크 및 확인 필요 사항
- UTF-8 바이트 기준 적용 시 기존 `maxLength`(문자 수) 속성과 동작 차이가 발생할 수 있음
- 클라이언트 선검증과 서버 검증 계산 방식이 조금이라도 다르면 사용자 경험 불일치 발생
- 정책 확정 완료(2026-02-22): 한글 체감 길이 유지 + 영어 입력 완화를 위해 기존 문자수 기준의 3배를 UTF-8 바이트 제한으로 적용

### 정책 확정 메모
- `HTML maxLength` 및 JavaScript `String.length`는 UTF-16 코드 유닛 기준이므로 바이트 제한 근거로 사용하지 않는다.
- 프론트엔드 바이트 계산은 `TextEncoder`(UTF-8) 기준으로 통일한다.
- 백엔드 바이트 계산은 `Buffer.byteLength(text, "utf8")`(또는 `TextEncoder`) 기준으로 통일하고, 프론트엔드와 동일 계산임을 테스트로 보장한다.

## 정책 결정 결과(확정본)
- 채팅 메시지 제한: 90 bytes (UTF-8 기준)
- 태스크 설명 제한: 300 bytes (UTF-8 기준)
- 말풍선/포커스 태스크명 제한: 45 bytes (UTF-8 기준)
- 초과 입력 처리 정책
  - 채팅: 클라이언트 선차단 + 서버 거부(무시)
  - 태스크 설명(생성/수정): 요청 전 차단 + 서버 거부
  - 포커스 태스크명(`focusing`, `focus_task_updating`): 클라이언트 선차단 + 서버 거부
- 기존 데이터 처리 정책: 기존 DB 데이터는 유지(소급 미적용), 신규 입력부터 정책 적용

## 검증 계획
### 1) 자동화 테스트 우선순위
- [ ] REALISTIC(E2E): Nest 앱 + Socket + 테스트 DB 기반 검증을 최우선으로 수행
- [ ] INTEGRATION: 프론트 스토어/소켓 매니저 통합 테스트로 입력 제어와 에러 상태 검증
- [ ] UNIT/MOCK: 바이트 계산 유틸 경계값 단위 테스트 보강

### 2) 핵심 시나리오
| # | 구현 계획 항목 | 테스트 유형 | 케이스 |
|---|----------------|-------------|--------|
| 1 | 채팅 바이트 제한 | REALISTIC(E2E) | 허용 경계(=limit bytes) 메시지는 `chatted` 전파, 초과 메시지는 미전파 |
| 2 | 태스크 설명 바이트 제한(생성/수정) | INTEGRATION + REALISTIC(E2E) | limit 이하 생성/수정 성공, 초과 입력 실패 및 에러 메시지 노출 |
| 3 | 포커스 태스크명(payload) 제한 | REALISTIC(E2E) | `focusing`/`focus_task_updating`에서 limit 이하 허용, 초과 시 정책대로 차단/정규화 |
| 4 | 말풍선 태스크명 표시 | INTEGRATION | 긴 문자열 표시 시 잘림/표시 규칙이 정책과 일치 |
| 5 | 한글/영어/혼합 입력 일관성 | UNIT + INTEGRATION | FE(`TextEncoder`)와 BE(`Buffer.byteLength`) 계산 결과 동일성 검증 |

### 3) 실행 명령
- [ ] `cd backend && pnpm test:e2e`
- [ ] `cd backend && pnpm test`
- [ ] `cd frontend && pnpm test --run`

### 4) 수동 시나리오 검증
- [ ] 동일 바이트 제한에서 한글/영어/혼합 문자열을 입력해 체감 제한이 정책과 일치하는지 확인
- [ ] 채팅 입력창/태스크 입력창/태스크 수정/집중 태스크명 변경 흐름에서 FE-서버 응답 불일치가 없는지 확인
- [ ] 신규 정책 초과 기존 데이터가 있어도 기존 데이터는 유지되고, 신규 입력만 제한이 적용되는지 확인

### 5) 통과 기준
- [ ] limit bytes 경계 입력은 모두 성공, limit+1 bytes 입력은 정책대로 모두 실패(또는 정규화)
- [ ] 채팅/태스크/포커스 태스크명의 FE 선검증과 BE 검증 결과가 동일
- [ ] 관련 테스트 스위트(E2E/통합/단위)가 CI 기준으로 재현 가능하게 통과

## 완료 정의 (Definition of Done)
- [ ] 채팅/태스크/포커스 태스크명 제한이 확정된 바이트 정책으로 코드에 반영됨
- [ ] FE/BE 바이트 계산 불일치 케이스가 테스트로 방지됨
- [ ] 백엔드 단위/E2E, 프론트 통합 테스트가 모두 통과함
- [ ] `docs/api/SOCKET_EVENTS.md`, `docs/api/REST_ENDPOINTS.md`, `docs/architecture/GAME_ENGINE.md` 및 관련 가이드 문서가 동기화됨
- [ ] `frontend/src/locales/*/common.json`의 길이 제한 안내 문구가 최종 정책 기준으로 업데이트됨
