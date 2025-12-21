# PR 분리 계획

`fix/github-polling-duplicate` 브랜치의 커밋들을 기능 단위로 분리하여 개별 PR로 머지하기 위한 계획

## 개요

| 순서 | PR | 브랜치명 | 커밋 수 | 설명 |
|------|-----|---------|---------|------|
| 1 | PR 1-A | `fix/#52-github-polling-duplicate` | 2개 | 중복 폴링 문제 해결 |
| 2 | PR 1-B | `feat/#51-github-graphql-api` | 3개 | REST → GraphQL 전환 |
| 3 | PR 2 | `feat/#49-restore-state-on-refresh` | 2개 | 새로고침 상태 복원 |
| 4 | PR 3 | `feat/#55-prevent-duplicate-session` | 3개 | 중복 접속 방지 |

## 이슈 매칭

| PR | 관련 이슈 | 이슈 제목 |
|----|----------|-----------|
| **PR 1-A** | [#52](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/52) | fix: BE: 특정 작업(로깅, 깃허브 활동)이 반복되는 문제 |
| **PR 1-B** | [#51](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/51) | fix: BE: Github 활동 수치 정보가 바로바로 전송되지 않는 문제 |
| **PR 2** | [#49](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/49) | fix: FE: 접속시 기존 게이지바 수치가 초기화 되는 문제 |
| | [#48](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/48) | fix: BE: 접속 이벤트 전달시 다른 사용자들의 접속 시간, 현재 게이지바 수치를 프론트엔드로 전달 |
| | [#54](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/54) | feat: 새로고침을 진행한 다른 사용자의 접속 시간이 0분으로 뜨는 문제 |
| **PR 3** | [#55](https://github.com/boostcampwm2025/web19-estrogenquattro/issues/55) | feat: 같은 사용자 중복 접속 방지 (새 탭 접속 시 이전 세션 종료) |

---

## PR 1-A: GitHub 폴링 중복 문제 해결

**브랜치명**: `fix/#52-github-polling-duplicate`

**목적**: 같은 유저의 여러 클라이언트 접속 시 중복 폴링 방지 + NestJS 싱글톤 문제 해결

**관련 이슈**: closes #52

### 커밋 목록

#### 1. `91a854d` - fix: GitHub 폴링 중복 문제 해결 (username 기준 관리)

**변경 파일**:
- `backend/src/github/github.gateway.ts`
- `backend/src/github/github.poll-service.ts`
- `frontend/src/game/scenes/MapScene.ts`

**설명**:
- pollingSchedules를 clientId 대신 username 기준으로 관리
- 같은 유저의 여러 클라이언트 접속 시 하나의 폴링만 유지
- ETag와 폴링 스케줄의 스코프 불일치 문제 해결
- GithubEventData에서 불필요한 clientId 필드 제거

#### 2. `069e102` - fix: NestJS 모듈 중복 등록 문제 해결

**변경 파일**:
- `backend/src/app.module.ts`
- `backend/src/github/github.module.ts`
- `backend/src/player/player.module.ts`

**설명**:
- GithubModule에서 exports 추가
- PlayerModule, AppModule에서 중복 providers 제거
- GithubPollService가 싱글톤으로 동작하도록 수정

---

## PR 1-B: GitHub GraphQL API 전환

**브랜치명**: `feat/#51-github-graphql-api`

**목적**: REST API 캐시 문제 해결을 위해 GraphQL API로 전환

**관련 이슈**: closes #51

**참고**: REST API 캐시 우회 시도 커밋들(8개)은 실패하여 제외, GraphQL 전환 관련 커밋만 포함

### 제외된 커밋 (REST API 캐시 우회 실패 시도들)

| 커밋 | 메시지 | 제외 이유 |
|------|--------|-----------|
| `f59b357` | feat: GitHub 폴링 디버깅 로그 개선 | GraphQL 전환 시 로깅 재작성됨 |
| `8a58692` | refactor: ETag 제거, 30초 단순 폴링으로 변경 | REST API 관련 |
| `2257e56` | feat: GitHub 폴링 응답 상세 로깅 추가 | REST API 응답 로깅 |
| `997a028` | debug: 이벤트 actor/repo 정보 로깅 추가 | 디버깅용 임시 로그 |
| `bbb8c5d` | test: OAuth 토큰 없이 GitHub API 요청 | 실패한 캐시 우회 테스트 |
| `9d158e7` | fix: OAuth 토큰 유지하면서 캐시 우회 헤더 추가 | 실패한 캐시 우회 시도 |
| `c7d0947` | fix: 인증 없이 GitHub API 요청 | 실패한 캐시 우회 시도 |
| `472eefe` | fix: ETag/If-Modified-Since 헤더로 캐시 강제 무효화 | 실패한 캐시 우회 시도 |

### 커밋 목록

#### 1. `e5a2e09` - feat: GitHub GraphQL API로 전환 (REST API 캐시 문제 우회)

**변경 파일**:
- `backend/src/github/github.poll-service.ts`

**설명**:
- REST API에서 GraphQL API로 전환
- 캐시 문제 우회

#### 2. `4bbd060` - fix: GraphQL 날짜 집계 문제 해결 (시간→커밋 수 비교로 변경)

**변경 파일**:
- `backend/src/github/github.poll-service.ts`

**설명**:
- 시간 기반 비교에서 커밋 수 기반 비교로 변경

#### 3. `baef2a9` - chore: GraphQL 응답 전체 로깅 제거

**변경 파일**:
- `backend/src/github/github.poll-service.ts`

**설명**:
- 불필요한 디버깅 로그 정리

---

## PR 2: 새로고침 시 상태 복원

**브랜치명**: `feat/#49-restore-state-on-refresh`

**목적**: 새로고침해도 게이지바, 기여 리스트, 접속시간, GitHub 폴링 기준점 유지

**관련 이슈**: closes #48, closes #49, closes #54

### 커밋 목록

#### 1. `b65981b` - feat: 새로고침 시 게이지바/기여리스트/접속시간 복원

**변경 파일**:
- `backend/src/github/github.gateway.ts`
- `backend/src/player/player.gateway.ts`
- `backend/src/player/player.play-time-service.ts`
- `frontend/src/game/scenes/MapScene.ts`
- `frontend/src/game/ui/createContributionList.ts`
- `frontend/src/game/ui/createProgressBar.ts`

**설명**:
- 게이지바, 기여 리스트, 접속시간 상태 복원

#### 2. `6a87fc8` - fix: GitHub 폴링 기준점 새로고침 시에도 유지

**변경 파일**:
- `backend/src/github/github.poll-service.ts`
- `docs/github-graphql-response-sample.json`

**설명**:
- 새로고침 시에도 GitHub 폴링 기준점 유지하여 중복 이벤트 방지

---

## PR 3: 중복 접속 방지

**브랜치명**: `feat/#55-prevent-duplicate-session`

**목적**: 같은 사용자가 여러 탭으로 접속 시 이전 세션 종료

**관련 이슈**: closes #55

### 커밋 목록

#### 1. `7a76ce6` - feat: 같은 사용자 중복 접속 방지 (새 탭 접속 시 이전 세션 종료)

**변경 파일**:
- `backend/src/player/player.gateway.ts`

#### 2. `6523262` - feat: 새로고침 시 같은 방 모든 사용자 접속시간 동기화

**변경 파일**:
- `backend/src/player/player.gateway.ts`

#### 3. `3f1d455` - feat: 다른 탭 접속 시 이전 탭에 세션 종료 오버레이 표시

**변경 파일**:
- `frontend/src/game/scenes/MapScene.ts`

---

## 의존성 및 머지 순서

```
PR 1-A (중복 폴링)
    ↓
PR 1-B (GraphQL 전환) ← github.poll-service.ts 의존
    ↓
PR 2 (상태 복원)
    ↓
PR 3 (중복 접속 방지) ← player.gateway.ts 의존
```

**권장 순서**: PR 1-A → PR 1-B → PR 2 → PR 3

---

## 워크플로우

각 PR을 생성하는 단계:

```bash
# 1. main에서 브랜치 생성
git fetch origin main
git checkout origin/main
git checkout -b "{타입}/#이슈번호-작업내용"

# 2. 해당 커밋들 cherry-pick
git cherry-pick <commit-hash-1> <commit-hash-2> ...

# 3. CI 검사 (푸시 전 로컬에서 확인)
cd backend && pnpm lint && pnpm format && pnpm build && pnpm test && cd ..
cd frontend && pnpm lint && pnpm format && pnpm build && cd ..

# 4. 포맷팅/린트 문제 있으면 수정
cd backend && pnpm format:fix && pnpm lint:fix && cd ..
cd frontend && pnpm format:fix && pnpm lint:fix && cd ..

# 5. 수정사항 커밋에 포함
git add -A && git commit --amend --no-edit

# 6. 원격에 푸시
git push -u origin "{타입}/#이슈번호-작업내용"

# 7. GitHub PR 생성 (gh CLI 또는 웹)
gh pr create --title "타입: 제목" --body "..."
```

### 의존성 있는 PR 처리

PR 1-B는 PR 1-A에 의존하므로:
1. PR 1-A 브랜치에서 시작하여 PR 1-B 브랜치 생성
2. PR의 base는 main으로 설정
3. PR 1-A가 먼저 머지되면 PR 1-B의 중복 커밋은 자동 제거됨

---

## 작업 체크리스트

- [x] PR 1-A: `fix/#52-github-polling-duplicate` 브랜치 생성 및 cherry-pick → [PR #56](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/56)
- [x] PR 1-B: `feat/#51-github-graphql-api` 브랜치 생성 및 cherry-pick → [PR #57](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/57)
- [x] PR 2: `feat/#49-restore-state-on-refresh` 브랜치 생성 및 cherry-pick → [PR #58](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/58)
- [x] PR 3: `feat/#55-prevent-duplicate-session` 브랜치 생성 및 cherry-pick → [PR #59](https://github.com/boostcampwm2025/web19-estrogenquattro/pull/59)
