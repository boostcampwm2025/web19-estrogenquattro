# 서비스 유스케이스

## 개요

`docs/pre-report.md`에서 사용자 행동 중심 항목만 추려 유스케이스로 재구성한 문서입니다.

- 포함: 서비스 기능(3.x), 사용자 시나리오(4)
- 제외: 기획 배경, 인프라/운영 계획, 회의/PR 기록

---

## 액터

| 액터 | 설명 |
|------|------|
| 개발자 사용자 | 서비스를 이용해 모각코를 진행하는 일반 사용자 |
| 운영자 | 제재/운영 기능을 관리하는 관리자 |
| GitHub | 사용자 활동 이벤트를 제공하는 외부 시스템 |

---

## 유스케이스 목록

| ID | 유스케이스 | 주요 액터 | 상태(기획서 기준) |
|----|-----------|-----------|------------------|
| UC-01 | GitHub 로그인 후 게임 접속 | 개발자 사용자 | 확정(MVP) |
| UC-02 | 랜덤 입장 또는 채널 선택으로 방 참여 | 개발자 사용자 | 확정(MVP) |
| UC-03 | 캐릭터 이동 및 동시 접속자 인지 | 개발자 사용자 | 확정(MVP) |
| UC-04 | 집중 시작/종료와 집중 시간 누적 | 개발자 사용자 | 확정+진행 |
| UC-05 | 투두 생성/완료와 일일 정산 반영 | 개발자 사용자 | 확정+진행 |
| UC-06 | GitHub 활동 감지 후 포인트/게이지 반영 | 개발자 사용자, GitHub | 확정+진행 |
| UC-07 | 공동 게이지 달성에 따른 맵 성장/시즌 순환 | 개발자 사용자 | 확정(MVP) |
| UC-08 | 말풍선 채팅으로 실시간 소통 | 개발자 사용자 | 확정(MVP) |
| UC-09 | 프로필/활동/랭킹 조회 | 개발자 사용자 | 확정+진행 |
| UC-10 | 펫 획득(가챠), 장착, 성장/진화 | 개발자 사용자 | 확정+진행 |
| UC-11 | 온보딩 투어/헬프로 사용법 학습 | 개발자 사용자 | 검토/진행 |
| UC-12 | 제재(블랙리스트) 기반 운영 관리 | 운영자 | 검토/진행 |

---

## 서버 유사 환경 테스트 커버리지

### 산정 기준

- 본 섹션은 **목(mock) 기반 단위 테스트를 제외**하고 산정한다.
- 점수는 코드 기준의 **정성 추정치(0~100)**이며, Jest line coverage 수치와는 다르다.
- 포함 테스트:
  - Nest 앱 + Socket + in-memory SQLite E2E: `backend/test/focustime.e2e-spec.ts`, `backend/test/auth-flow.e2e-spec.ts`, `backend/test/chat.e2e-spec.ts`, `backend/test/pet-system.e2e-spec.ts`, `backend/test/movement-sync.e2e-spec.ts`, `backend/test/progress-season.e2e-spec.ts`, `backend/test/onboarding.e2e-spec.ts`
  - TypeORM in-memory SQLite 통합 테스트(서비스 레벨): `backend/src/*/*.service.spec.ts` 일부
  - 실 API 통합 테스트: `backend/src/github/github.poll-service.integration.spec.ts`
  - 서버 유사 부하 테스트 시나리오: `backend/load-test/artillery/*.yml`
- 제외 테스트(본 산정에서 미반영):
  - 목/스텁 중심 게이트웨이/서비스 단위 테스트
  - 프론트엔드 컴포넌트/스토어 테스트(MSW 기반)

### 유스케이스별 커버리지 매트릭스

| ID | 커버리지(추정) | 근거 테스트(비목/비유닛 기준) | 판단 |
|----|----------------|------------------------------|------|
| UC-01 | 70 | `backend/test/auth-flow.e2e-spec.ts`, `backend/src/player/player.service.spec.ts` | OAuth 콜백 쿠키 발급, `/auth/me` 인증 성공/실패(누락/만료/위조), 로그아웃 계약이 HTTP E2E로 검증됨. |
| UC-02 | 65 | `backend/test/focustime.e2e-spec.ts`, `backend/load-test/artillery/test-state-change.yml` | 실제 Socket 입장(`joining`→`joined`)과 방 참여 시나리오가 검증됨. 예약/채널 전환 전체 플로우 E2E는 부족함. |
| UC-03 | 75 | `backend/test/movement-sync.e2e-spec.ts`, `backend/load-test/artillery/test-per-frame-json.yml`, `backend/load-test/artillery/test-per-frame-binary.yml` | 같은 방 이동 동기화, 다른 방 격리, disconnect 시 `player_left` 브로드캐스트가 실제 소켓 E2E로 검증됨. |
| UC-04 | 90 | `backend/test/focustime.e2e-spec.ts`, `backend/src/focustime/focustime.service.spec.ts` | 집중 시작/종료, 재접속 복원, disconnect 정산, DB 반영까지 높은 수준으로 검증됨. |
| UC-05 | 75 | `backend/src/task/task.service.spec.ts`, `backend/src/point/point.service.spec.ts` | Task CRUD/소유권/날짜 범위/포인트 반영은 검증됨. 스케줄러 기반 자정 배치 전체 흐름 검증은 약함. |
| UC-06 | 60 | `backend/src/github/github.poll-service.integration.spec.ts`, `backend/src/point/point.service.spec.ts` | 실 GitHub API 응답/ETag/타입 검증 + 포인트 적립 검증은 있음. GitHub 이벤트→게이지 브로드캐스트 종단 E2E는 부족함. |
| UC-07 | 70 | `backend/test/progress-season.e2e-spec.ts` | 임계치 경계 map 전환, 마지막 맵 clamp, `season_reset`, 파일 DB 재기동 복원이 서버 유사 환경에서 검증됨. |
| UC-08 | 70 | `backend/test/chat.e2e-spec.ts` | 같은 방 채팅 전달, 공백/길이 초과 차단, 방 격리가 실제 소켓 세션에서 검증됨. |
| UC-09 | 70 | `backend/src/point/point.service.spec.ts`, `backend/src/pointhistory/point-history.service.spec.ts`, `backend/src/focustime/focustime.service.spec.ts` | 활동/랭킹/집중 통계 계산은 DB 통합으로 검증됨. 실제 모달 API 종단 검증은 부족함. |
| UC-10 | 70 | `backend/test/pet-system.e2e-spec.ts` | 가챠/중복 환급/먹이/진화/장착 및 실패 경로(포인트 부족, 미보유 장착)가 DB+소켓 기준으로 검증됨. |
| UC-11 | 65 | `backend/test/onboarding.e2e-spec.ts`, `backend/src/player/player.service.spec.ts` | 온보딩 완료 API의 상태 전환, 재호출 idempotent, 인증 실패(401)가 HTTP E2E로 검증됨. |
| UC-12 | 0 | - | 제재/블랙리스트 운영 기능의 서버 유사 통합 테스트 근거 없음. |

### 요약

- 강한 영역: `UC-01`, `UC-03`, `UC-04`, `UC-05`, `UC-07`, `UC-08`, `UC-09`, `UC-10`, `UC-11`
- 중간 영역: `UC-02`, `UC-06`
- 취약 영역: `UC-12`

---

## 유스케이스 상세

### UC-01 GitHub 로그인 후 게임 접속

- 목적: 인증된 사용자가 즉시 모각코 공간에 진입한다.
- 선행 조건: 사용자가 GitHub 계정을 보유한다.
- 기본 흐름:
  1. 사용자가 GitHub 소셜 로그인을 수행한다.
  2. 시스템이 사용자 식별 정보를 동기화한다.
  3. 사용자가 게임 맵에 스폰된다.
- 결과: 사용자 세션이 생성되고 게임 플레이가 가능한 상태가 된다.

### UC-02 랜덤 입장 또는 채널 선택으로 방 참여

- 목적: 사용자가 빠르게 작업 공간(방)에 참여한다.
- 선행 조건: 로그인 완료 상태.
- 기본 흐름:
  1. 사용자는 첫 입장 시 자동 배정(랜덤/정책 기반)을 받는다.
  2. 필요 시 채널 선택 UI에서 다른 방을 선택한다.
  3. 시스템이 입장 가능 여부를 확인하고 방 이동을 처리한다.
- 결과: 사용자가 특정 방에 소속되어 다른 참여자와 동기화된다.

### UC-03 캐릭터 이동 및 동시 접속자 인지

- 목적: 같은 공간에서 함께 작업하는 존재감을 제공한다.
- 선행 조건: 같은 방에 1명 이상 접속.
- 기본 흐름:
  1. 사용자가 캐릭터를 이동한다.
  2. 시스템이 이동 상태를 동기화한다.
  3. 다른 사용자는 닉네임/상태를 보며 상호 존재를 인지한다.
- 결과: 실시간 공간감이 유지된다.

### UC-04 집중 시작/종료와 집중 시간 누적

- 목적: 사용자의 몰입 시간을 기록하고 동기부여 지표로 활용한다.
- 선행 조건: 사용자가 작업 상태를 전환할 수 있다.
- 기본 흐름:
  1. 사용자가 집중 시작을 수행한다.
  2. 시스템이 집중 시간을 누적한다.
  3. 사용자가 휴식 전환 시 누적 시간을 저장한다.
- 결과: 일일 집중 시간이 업데이트된다.

### UC-05 투두 생성/완료와 일일 정산 반영

- 목적: 작업 단위를 관리하고 성취를 기록한다.
- 선행 조건: 사용자가 투두 기능을 사용할 수 있다.
- 기본 흐름:
  1. 사용자가 투두를 생성/수정/완료한다.
  2. 시스템이 완료 상태와 시간을 기록한다.
  3. 자정 정산 시 투두 완료분이 일일 지표와 포인트에 반영된다.
- 결과: 사용자 활동 기록이 통계에 반영된다.

### UC-06 GitHub 활동 감지 후 포인트/게이지 반영

- 목적: 실제 개발 활동을 게임 진행에 연결한다.
- 선행 조건: GitHub 연동 완료 상태.
- 기본 흐름:
  1. 사용자가 로컬에서 개발 후 push/PR/리뷰/이슈 활동을 수행한다.
  2. 시스템이 GitHub 이벤트를 폴링해 활동을 감지한다.
  3. 활동 가중치에 따라 포인트와 공동 게이지를 갱신한다.
- 결과: 개인/공동 성과가 즉시(또는 폴링 주기 내) 반영된다.

### UC-07 공동 게이지 달성에 따른 맵 성장/시즌 순환

- 목적: 개인 활동이 공동 세계 변화로 이어지는 경험을 제공한다.
- 선행 조건: 방/시즌 게이지 시스템 활성화.
- 기본 흐름:
  1. 방의 누적 기여로 게이지가 증가한다.
  2. 임계값 도달 시 맵 스테이지가 전환된다.
  3. 시즌 주기에 따라 테마가 순환/초기화된다.
- 결과: 사용자는 협업 성과를 시각적으로 체감한다.

### UC-08 말풍선 채팅으로 실시간 소통

- 목적: 작업 중 가벼운 상호작용을 지원한다.
- 선행 조건: 같은 방 사용자 접속.
- 기본 흐름:
  1. 사용자가 메시지를 입력/전송한다.
  2. 시스템이 말풍선 메시지를 같은 공간 사용자에게 전파한다.
  3. 메시지는 일정 규칙(길이/표시 시간)에 따라 처리된다.
- 결과: 음성 없이도 커뮤니케이션이 가능하다.

### UC-09 프로필/활동/랭킹 조회

- 목적: 개인 성취와 기여 현황을 확인한다.
- 선행 조건: 사용자 데이터가 누적되어 있다.
- 기본 흐름:
  1. 사용자가 프로필/활동/랭킹 UI를 연다.
  2. 시스템이 집중 시간, GitHub 활동, 포인트/순위를 제공한다.
  3. 사용자는 자신의 기록을 확인한다.
- 결과: 자기 점검형 동기부여가 강화된다.

### UC-10 펫 획득(가챠), 장착, 성장/진화

- 목적: 리워드 소비와 지속 참여 동기를 제공한다.
- 선행 조건: 사용자가 포인트를 보유한다.
- 기본 흐름:
  1. 사용자가 가챠로 펫을 획득한다.
  2. 도감에서 대표 펫을 장착한다.
  3. 포인트를 사용해 성장시키고 조건 충족 시 진화시킨다.
- 결과: 펫 상태가 사용자 캐릭터와 기록에 반영된다.

### UC-11 온보딩 투어/헬프로 사용법 학습

- 목적: 신규 사용자의 초기 이탈을 줄인다.
- 선행 조건: 신규 사용자 또는 헬프 재실행 요청.
- 기본 흐름:
  1. 시스템이 핵심 기능(이동, 채팅, 게이지, 펫, 태스크)을 안내한다.
  2. 사용자가 튜토리얼을 완료하거나 다시 열람한다.
- 결과: 사용자가 핵심 루프를 이해한 상태로 진입한다.

### UC-12 제재(블랙리스트) 기반 운영 관리

- 목적: 어뷰징 사용자를 통제해 운영 안정성을 확보한다.
- 선행 조건: 운영자 권한 보유.
- 기본 흐름:
  1. 운영자가 어드민 도구에서 사용자 상태를 확인한다.
  2. 필요 시 블랙리스트/제재 조치를 수행한다.
- 결과: 서비스 운영 정책이 반영된다.

---

## 대표 End-to-End 시나리오

```text
1. 사용자가 GitHub 소셜 로그인으로 서비스에 접속한다.
2. 사용자가 방에 입장해 캐릭터를 이동하고 작업을 시작한다.
3. 사용자가 로컬에서 개발 후 git push를 수행한다.
4. 시스템이 GitHub 이벤트를 감지해 게이지/포인트를 반영한다.
5. 임계값 달성 시 맵이 성장하고 같은 방 사용자에게 동기화된다.
6. 사용자는 채팅/프로필/펫 기능을 통해 상호작용하며 세션을 지속한다.
```

---

## Sources

- `docs/pre-report.md`
- `backend/test/focustime.e2e-spec.ts`
- `backend/src/focustime/focustime.service.spec.ts`
- `backend/src/task/task.service.spec.ts`
- `backend/src/point/point.service.spec.ts`
- `backend/src/pointhistory/point-history.service.spec.ts`
- `backend/src/player/player.service.spec.ts`
- `backend/src/github/github.poll-service.integration.spec.ts`
- `backend/load-test/artillery/test-state-change.yml`
- `backend/load-test/artillery/test-per-frame-json.yml`
- `backend/load-test/artillery/test-per-frame-binary.yml`
- `backend/load-test/artillery/load-test-server.ts`
