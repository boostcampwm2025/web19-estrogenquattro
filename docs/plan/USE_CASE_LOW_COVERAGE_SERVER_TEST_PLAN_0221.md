# 저커버리지 유스케이스 서버 유사 테스트 계획표

- 작성일: 2026-02-21
- 기준 문서: `docs/features/USE_CASES.md`
- 대상 범위: 커버리지 50 미만 유스케이스 (`UC-01`, `UC-03`, `UC-07`, `UC-08`, `UC-10`, `UC-11`)

---

## 목표

| 항목 | 현재 | 목표 |
|------|------|------|
| 저커버리지 UC 개수 | 6개 | 6개 모두 60 이상 |
| 테스트 성격 | 서비스/게이트웨이 단위 치중 | Nest 앱 + Socket + 테스트 DB 기반 E2E/통합 중심 |
| 운영 리스크 | 인증/채팅/펫/시즌 흐름 미검증 구간 존재 | 핵심 사용자 흐름 서버 유사 환경에서 회귀 가능 |

---

## 공통 테스트 환경

| 항목 | 설정 |
|------|------|
| 앱 실행 | `createNestApplication()` + 랜덤 포트 (`app.listen(0)`) |
| DB | SQLite (`:memory:`) 기본, 필요 시 테스트 파일 DB |
| 인증 | JWT 쿠키(`access_token`) 실 주입 |
| 소켓 클라이언트 | `socket.io-client` 2~3개 동시 접속 |
| 외부 연동 | GitHub는 테스트용 HTTP 서버(또는 고정 fixture 응답)로 계약 검증 |
| 테스트 작성 규칙 | 테스트명은 행위 중심 한글, 각 테스트는 Given/When/Then 주석 필수 |
| 실행 명령 | `cd backend && pnpm test:e2e` |

### 공통 테스트 하네스 전략

| 항목 | 전략 |
|------|------|
| UC-01 인증 콜백 | `GithubGuard` override를 고정 적용해 테스트 사용자 주입 후 `/auth/github/callback` 쿠키/리다이렉트 계약 검증 |
| 소켓 E2E 공통 | `UserStore` 시드 + JWT 쿠키 소켓 생성 헬퍼 + 이벤트 대기 타임아웃 헬퍼 공통화 |
| UC-10 펫 시드 | `beforeEach`에서 Stage 1 펫 마스터 데이터, 플레이어 포인트, 도감/인벤토리 초기 상태를 명시적으로 시드 |
| UC-07 복원 검증 | 같은 테스트 프로세스에서 앱 인스턴스 close/recreate + 파일 DB 유지 방식으로 `GlobalState` 복원 검증 |

---

## 유스케이스별 테스트 계획표

| 우선순위 | UC | 현재→목표 | 서버 유사 테스트 시나리오 | 예상 테스트 파일 | 완료 기준 |
|----------|----|-----------|--------------------------|------------------|-----------|
| P0 | UC-01 GitHub 로그인 후 게임 접속 | 20→70 | 1) 콜백 성공 시 JWT 쿠키 발급 및 리다이렉트 2) 쿠키 포함 `GET /auth/me` 성공 3) `GET /auth/logout` 쿠키 제거 4) 누락/만료/위조 쿠키로 `GET /auth/me` 호출 시 `401` | `backend/test/auth-flow.e2e-spec.ts` | 인증 쿠키 발급/검증/로그아웃 및 인증 실패 경로가 HTTP 레벨에서 재현되고 CI에서 안정 통과 |
| P0 | UC-08 말풍선 채팅 | 10→70 | 1) 두 소켓 입장 후 `chatting` 송신 시 상대 소켓 `chatted` 수신 2) 길이 초과/공백 메시지 차단 3) 방이 다르면 미수신 | `backend/test/chat.e2e-spec.ts` | 채팅 허용/차단/격리 규칙이 실제 소켓 세션 기준으로 검증 |
| P0 | UC-10 펫 획득/장착/성장/진화 | 5→70 | 1) `POST /api/pets/gacha` 포인트 차감 + 인벤토리 반영 2) 중복 가챠 후 `gacha/refund` 반영 3) `feed`/`evolve` 진화 조건 검증 4) 장착 후 소켓 `pet_equipped` 전파 5) 포인트 부족 가챠/먹이주기 `400` 6) 미보유 펫 장착 시 `400` | `backend/test/pet-system.e2e-spec.ts` | 가챠-성장-진화-장착 핵심 루프와 실패 경로가 DB 상태 + 소켓 이벤트로 검증 |
| P1 | UC-03 캐릭터 이동/동시 인지 | 45→75 | 1) 같은 방 소켓 A `moving` 송신 시 B `moved` 수신 2) 다른 방 소켓은 미수신 3) disconnect 시 `player_left` 브로드캐스트 | `backend/test/movement-sync.e2e-spec.ts` | 이동 동기화/방 격리/퇴장 알림이 종단 시나리오로 재현 |
| P1 | UC-07 맵 성장/시즌 순환 | 25→70 | 1단계(`:memory:`): 1) threshold 직전/도달/초과 경계에서 `map_switch` + 진행값 리셋 검증 2) 마지막 맵 상한 clamp 3) `season_reset` + 상태 초기화 2단계(파일 DB): 4) 앱 재기동 후 `GlobalState` 복원 검증 | `backend/test/progress-season.e2e-spec.ts` | 1단계(전환/리셋/경계) + 2단계(재기동 복원) 모두 회귀 가능 |
| P1 | UC-11 온보딩/헬프 | 25→65 | 1) `PATCH /api/players/newbie` 호출 시 `isNewbie=false` 반영 2) 재호출 idempotent 3) 인증 없는 호출 401 | `backend/test/onboarding.e2e-spec.ts` | 온보딩 완료 상태 전환이 API 계약 기준으로 검증 |

---

## 상세 케이스 테이블

| 케이스 ID | 대상 UC | Given | When | Then |
|-----------|---------|-------|------|------|
| TC-AUTH-01 | UC-01 | 유효한 테스트 사용자와 JWT 쿠키 | `GET /auth/me` | `200` + 필수 필드(`githubId`, `username`, `avatarUrl`) 존재, `playerId` 필드 포함 확인 |
| TC-AUTH-NEG-01 | UC-01 | 누락/만료/위조 JWT 쿠키 | `GET /auth/me` | `401 Unauthorized` |
| TC-CHAT-01 | UC-08 | 같은 방 사용자 2명 접속 | A가 `chatting` 전송 | B가 `chatted` 이벤트 수신 |
| TC-PET-01 | UC-10 | 포인트 100 이상, stage1 펫 시드 | `POST /api/pets/gacha` | 포인트 감소 + 인벤토리/도감 업데이트 |
| TC-PET-NEG-01 | UC-10 | 포인트 100 미만 사용자 | `POST /api/pets/gacha` | `400 Not enough points` |
| TC-PET-NEG-02 | UC-10 | 도감에 없는 펫 ID | `PATCH /api/players/me/equipped-pet` | `400 You do not own this pet` |
| TC-MOVE-01 | UC-03 | 같은 방 사용자 2명 접속 | A가 `moving` 전송 | B가 `moved` 이벤트 수신 |
| TC-MAP-01 | UC-07 | 진행도 임계치 직전 상태 | 점수 가산 이벤트 발생 | `map_switch` 발생 + mapIndex 증가 |
| TC-MAP-EDGE-01 | UC-07 | 마지막 맵(mapIndex=4), 진행도 임계치 근접 상태 | 점수 가산 이벤트 발생 | 진행도는 상한값(500)으로 clamp, 추가 `map_switch` 없음 |
| TC-ONBOARD-01 | UC-11 | `isNewbie=true` 사용자 | `PATCH /api/players/newbie` | DB에서 `isNewbie=false` 확인 |
| TC-ONBOARD-NEG-01 | UC-11 | JWT 쿠키 없는 요청 | `PATCH /api/players/newbie` | `401 Unauthorized` |

---

## 구현 순서

| 순서 | 작업 | 이유 |
|------|------|------|
| 1 | `UC-01`, `UC-08`, `UC-10` E2E 추가 | 사용자 체감/리스크가 큰 인증-소통-리워드 루프 우선 (종료 조건: 해당 UC 테스트 파일 작성 + `pnpm test:e2e` 통과 + 케이스 테이블 체크) |
| 2 | `UC-03`, `UC-07`, `UC-11` E2E 추가 | 실시간 동기화/시즌/온보딩 안정화 (종료 조건: 해당 UC 테스트 파일 작성 + `pnpm test:e2e` 통과 + 케이스 테이블 체크) |

---

## 리스크 및 선행 조건

| 항목 | 내용 | 대응 |
|------|------|------|
| GitHub OAuth 실연동 E2E 난이도 | 외부 OAuth 리다이렉트 의존 | 콜백 계약 테스트 + `/auth/me` 계약 테스트로 분리 |
| UC-07 재기동 복원 검증 난이도 | `:memory:` DB는 프로세스 종료 시 상태 소멸 | 파일 DB 기반 2단계 시나리오를 별도 구간으로 분리해 검증 |
| 소켓 테스트 flaky 가능성 | 비동기 타이밍 민감 | 이벤트 대기 타임아웃 표준화(예: 5초), 공통 헬퍼 도입 |

---

## 완료 정의 (Definition of Done)

| 항목 | 기준 |
|------|------|
| 테스트 코드 | 계획표의 P0/P1 케이스 구현 완료 |
| CI | `cd backend && pnpm test:e2e` 안정 통과 |
| 검증 게이트 | `cd backend && pnpm lint && pnpm format && pnpm build && pnpm test && pnpm test:e2e` 통과 |
| 문서 | `docs/features/USE_CASES.md` 커버리지 표 수치 업데이트 |
| 검증 | 실패 케이스(인증 실패/권한 없음/유효성 실패) 최소 1개 이상 포함 |
| 케이스 균형 | P0/P1 각 UC마다 성공 케이스와 실패/경계 케이스 최소 1쌍 이상 포함 |

### 커버리지 재산정 규칙

| 항목 | 기준 |
|------|------|
| 기준 문서 | `docs/features/USE_CASES.md`의 "서버 유사 환경 테스트 커버리지" 섹션 |
| 재산정 시점 | P0 완료 직후 1회, P1 완료 직후 1회 |
| 산정 방식 | 기존 정성 매트릭스(0~100) 산정 기준과 동일 기준 유지 |
| 반영 방식 | 유스케이스별 커버리지 수치/근거 테스트/판단 코멘트 동시 업데이트 |

## PR 리뷰 반영 내역 (2026-02-22)

- 코멘트: Backend E2E CI job timeout 누락
  - 변경 파일: `.github/workflows/backend-e2e-ci.yml`
  - 변경 내용: `jobs.e2e.timeout-minutes: 15` 추가
  - 검증: PR GitHub Actions 재실행 시 `Backend E2E CI` 성공 확인

- 코멘트: auth/me 테스트에서 callback 쿠키 누락 시 실패 원인 불명확
  - 변경 파일: `backend/test/auth-flow.e2e-spec.ts`
  - 변경 내용: `callbackCookie` 선검증(`toBeDefined`) 추가 후 쿠키 값을 명시적으로 주입
  - 검증: `cd backend && pnpm test:e2e --runInBand` 통과

- 코멘트: TC-MAP-EDGE-01 설명이 테스트 기대치와 모호하게 불일치
  - 변경 파일: `docs/plan/USE_CASE_LOW_COVERAGE_SERVER_TEST_PLAN_0221.md`
  - 변경 내용: Then 절을 `상한값(500)으로 clamp`로 명시
  - 검증: `backend/test/progress-season.e2e-spec.ts` 기대치와 수동 대조

- 코멘트: `docs/pre-report.md` 코드 펜스 언어 미지정(MD040)
  - 변경 파일: `docs/pre-report.md`
  - 변경 내용: 코드 블록 시작 펜스를 ` ```text `로 변경
  - 검증: 문서 렌더링/린트 규칙 수동 확인
