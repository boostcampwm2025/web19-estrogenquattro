# ISSUE #521 fix: GitHub 아이디 변경 후 프로필 링크/표시명 미동기화

## 메타 정보
- Issue URL: https://github.com/boostcampwm2025/web19-estrogenquattro/issues/521
- Issue 번호: 521
- 기준 브랜치: main
- 작업 브랜치: issue-521-fix-github
- 브랜치 네이밍 비고: 현재 worktree 브랜치명을 사용하며, 머지 전 `fix/#521-...` 규칙 적용 여부를 확인한다.
- Worktree 경로: /home/fpg123/Workspace/boost/web19-estrogenquattro/.worktrees/issue-521-fix-github
- 작성일: 2026-02-25

## 배경/문제
GitHub OAuth 가입 후 사용자가 GitHub username을 변경하면 서비스 내 프로필 표시명과 GitHub 프로필 링크가 이전 username에 고정되어 최신 계정 정보와 불일치한다. 제보자는 가입 당일 username 변경 이후 프로필 클릭 시 이전 주소로 이동해 자신의 GitHub 주소를 찾지 못하는 문제를 보고했다.

## 목표
- [ ] GitHub 재로그인/인증 시 사용자 username, avatarUrl이 최신 값으로 동기화되도록 수정
- [ ] 플레이어 닉네임/프로필 UI 링크가 최신 username을 사용하도록 정합성 확보
- [ ] 회귀 테스트로 username 변경 후 재로그인 시나리오를 검증

## 범위
### 포함
- auth 계층의 사용자 정보 갱신 로직(`githubId` 기준 upsert) 수정
- player 계층의 기존 사용자 nickname 갱신 정책 반영
- `/auth/me` 기반 프론트 프로필 표시/링크 최신화 확인
- 관련 단위 테스트/통합 테스트 보강
- 문서 동기화(`docs/features/AUTH_FLOW.md`, `docs/api/SOCKET_EVENTS.md`) 반영

### 제외
- 계정 삭제 기능 신규 도입
- GitHub 계정 병합/이관 같은 별도 계정 관리 기능
- 이번 이슈 범위를 벗어난 UI 전면 개편

## 구현 단계
1. [ ] 분석 및 재현
2. [ ] 구현
3. [ ] 테스트
4. [ ] 문서화/정리

## 의사결정 확정 사항
- 닉네임 동기화 정책: 동일 `githubId` 재로그인 시 `player.nickname`을 최신 GitHub `username`으로 항상 갱신한다.
- 세션 중복 방지 키 정책: `userSockets`를 `githubId` 기준으로 전환하는 방향으로 구현하며, 배포 후 이상 징후 시 즉시 롤백 가능하도록 분리 반영한다.
- 프론트 인증 타입 정책: `/auth/me` 응답 스키마(`githubId`, `username`, `avatarUrl`, `playerId`)를 단일 소스로 사용한다.
- 프로필 fallback 정책: GitHub에서 수신한 `username`/`avatarUrl`이 비정상(빈 문자열 등)일 때는 기존 저장값을 유지한다.

### 구현 상세
- `UserStore.findOrCreate`에서 기존 사용자 재로그인 시 `accessToken`뿐 아니라 `username`, `avatarUrl`도 최신 값으로 갱신한다. 단, 새 값이 비정상이면 기존 값을 유지한다.
- `PlayerService.findOrCreateBySocialId`에서 기존 플레이어 재로그인 시 `nickname`을 최신 GitHub `username`으로 갱신한다.
- `PlayerGateway.userSockets`의 중복 세션 키를 `username`에서 `githubId`로 전환해 username 변경 직후에도 기존 세션 정리가 일관되게 동작하도록 한다.
- 프론트 인증 스토어 타입을 `/auth/me` 실제 응답(`githubId`, `username`, `avatarUrl`, `playerId`)과 정합되게 맞춘다.

## 영향 파일(예상)
- `backend/src/auth/github.strategy.ts`
- `backend/src/auth/user.store.ts`
- `backend/src/player/player.service.ts`
- `backend/src/player/player.gateway.ts`
- `backend/src/auth/user.store.spec.ts` (신규 가능)
- `backend/src/player/player.service.spec.ts`
- `backend/test/auth-flow.e2e-spec.ts`
- `backend/test/*.e2e-spec.ts` (세션 교체/재로그인 회귀 케이스 추가)
- `frontend/src/stores/authStore.ts`
- `frontend/src/app/_components/UserInfoModal/tabs/ProfileTab/ProfileTab.tsx`
- `docs/features/AUTH_FLOW.md`
- `docs/api/SOCKET_EVENTS.md`

## 리스크 및 확인 필요 사항
- `UserStore`가 메모리 저장소라 서버 재시작/멀티 인스턴스 환경에서 동작 차이가 없는지 확인 필요
- 기존 nickname을 자동 갱신하는 정책으로 인해 사용자 체감 표시명이 변경될 수 있으므로 변경 공지/릴리즈 노트에 반영 필요
- `userSockets` 키를 `githubId`로 전환할 때 기존 세션 정리 이벤트(`session_replaced`) 회귀 여부 확인 필요
- 리더보드/포인트/집중시간 집계 API가 `player.nickname`을 노출하므로 닉네임 동기화 정책 변경 시 사용자 표시명에 연쇄 영향이 있는지 확인 필요
- GitHub 프로필 데이터가 일시적으로 비정상(빈 username, avatar 누락)일 때 덮어쓰기 정책을 적용하면 표시명/이미지가 비어 보일 수 있음

## 롤백/운영 대응
- 배포 직후 모니터링 포인트:
  - `/auth/me`의 `username`, `avatarUrl` 응답 분포
  - `session_replaced` 이벤트 발생 추이 및 비정상 disconnect 비율
  - 리더보드 `nickname` 변동량
- 최소 롤백 경로:
  - `userSockets` 키 정책 변경 커밋을 우선 롤백하여 실시간 접속 안정성을 먼저 복구
  - 닉네임 동기화 정책 변경은 별도 커밋으로 분리해 필요 시 선택 롤백
- 장애 대응 기준:
  - 재로그인 사용자에서 세션 강제 종료/중복 접속 이슈가 증가하면 즉시 키 정책 롤백
  - 프로필 표시명/아바타 공란 비율이 유의미하게 증가하면 프로필 덮어쓰기 fallback을 기존 값 유지로 전환

## 외부 검증 메모 (2026-02-25)
- GitHub username은 변경 가능하며, 변경 후 기존 프로필 URL은 404가 될 수 있다.
- 사용자 식별 키는 변경 가능한 `login`(username)보다 불변 `id`(githubId) 기준이 안전하다.
- OAuth scope `read:user`로 최신 프로필(`login`, `avatar_url`) 조회가 가능하다.
- `/auth/me` 응답 최신화 보장은 외부 문서만으로 완결 검증할 수 없으므로 프로젝트 내부 테스트로 확인한다.

## 검증 계획
### 1) 실서비스 유사 검증 (최우선)
- [ ] 동일 `githubId`에 대해 1차 로그인(username=A) 후 username 변경(username=B) 상태로 재로그인했을 때 `/auth/me`가 `username=B`, `avatarUrl` 최신값을 반환한다.
- [ ] 재로그인 이후 프로필 모달의 GitHub 링크가 `https://github.com/{B}`를 가리킨다.
- [ ] 기존 탭/세션이 `session_replaced` 이벤트를 수신하고 종료되며, 신규 세션만 유지된다.

### 2) 통합/E2E 테스트
- [ ] `backend/test/auth-flow.e2e-spec.ts`에 username 변경 후 재로그인 시 `/auth/me` 최신화 회귀 케이스를 추가한다.
- [ ] 소켓 E2E에 중복 세션 키를 `githubId` 기준으로 검증하는 회귀 케이스를 추가한다.

### 3) 단위 테스트
- [ ] `UserStore.findOrCreate`가 기존 유저 재로그인 시 `username`, `avatarUrl`, `accessToken`을 최신 값으로 갱신한다.
- [ ] `UserStore.findOrCreate`가 비정상 프로필 값(빈 `username`/`avatarUrl`) 입력 시 기존 값을 유지한다.
- [ ] `PlayerService.findOrCreateBySocialId`가 기존 플레이어 재로그인 시 닉네임 갱신 정책에 맞게 `nickname`을 처리한다.

### 4) 수동 시나리오 검증
- [ ] GitHub username 변경 전 로그인 사용자로 프로필 모달의 GitHub 링크가 기존 주소를 가리키는 상태를 재현한다.
- [ ] GitHub에서 username 변경 후 재로그인하면 프로필 모달 링크/표시명/아바타가 변경된 username 기준으로 즉시 반영된다.
- [ ] 변경 후 팔로우/언팔로우 및 활동 조회 API가 신규 username 기준으로 정상 동작한다.

### 통과 기준 (DoD)
- [ ] `/auth/me` 최신화, 프로필 링크 최신화, 중복 세션 정리(`session_replaced`)가 모두 통과한다.
- [ ] 통합/E2E에서 username 변경 회귀 관련 신규 실패가 없다.
- [ ] 단위 테스트에서 `UserStore`, `PlayerService` 갱신 정책이 문서화한 정책과 일치한다.
