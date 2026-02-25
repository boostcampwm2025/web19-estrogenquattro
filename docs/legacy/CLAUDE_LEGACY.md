# 프로젝트 개요

GitHub 활동(커밋, PR)을 실시간으로 감지하여 게임 내 프로그레스바에 반영하는 멀티플레이어 게이미피케이션 서비스

## 기술 스택

- **Frontend**: Next.js 16, React 19, Phaser 3.90, Zustand, Tailwind CSS 4
- **Backend**: NestJS 11, Socket.io 4.8, TypeORM, SQLite
- **인증**: GitHub OAuth2 + JWT (httpOnly 쿠키)

## 프로젝트 구조

```
.
├── backend/          # NestJS 백엔드 (포트 8080)
├── frontend/         # Next.js 프론트엔드 (SSG → backend/public으로 빌드)
└── docs/             # 문서
```

## 문서 참조

작업 전 반드시 관련 문서를 확인하세요:

@docs/README.md

### 주요 문서

- **아키텍처**: @docs/architecture/OVERVIEW.md
- **게임 엔진**: @docs/architecture/GAME_ENGINE.md
- **API 명세**: @docs/api/SOCKET_EVENTS.md, @docs/api/REST_ENDPOINTS.md
- **GitHub 폴링**: @docs/api/GITHUB_POLLING.md (GraphQL API, 30초 고정 폴링)
- **인증 흐름**: @docs/reference/AUTH_FLOW.md
- **포커스 타임**: @docs/reference/FOCUS_TIME.md
- **개발 가이드**: @docs/guides/DEVELOPMENT.md
- **DB/ERD**: @docs/guides/DATABASE.md, @docs/guides/ERD.md
- **테스트**: @docs/conventions/TEST_CONVENTION.md
- **컨벤션**: @docs/conventions/COMMIT_CONVENTION.md, @docs/conventions/PR_CONVENTION.md

## 작업 순서

1. **문서 먼저 확인** - 코드 수정/검색 전에 관련 문서 확인
   - 게임 관련: `@docs/architecture/GAME_ENGINE.md`
   - 소켓 이벤트: `@docs/api/SOCKET_EVENTS.md`
   - REST API: `@docs/api/REST_ENDPOINTS.md`
   - 포커스 타임: `@docs/reference/FOCUS_TIME.md`
   - DB/엔티티: `@docs/guides/DATABASE.md`, `@docs/guides/ERD.md`
   - 테스트 작성: `@docs/conventions/TEST_CONVENTION.md`
2. **코드 검색은 문서에 없을 때만**
3. **push 전 순서**: `/ci` 실행 → PR 본문 업데이트 → 문서 업데이트 → push
   - `/ci` 명령어로 CI 검사 통과 확인
   - PR 본문만 읽어도 작업 내용을 이해할 수 있도록 업데이트
   - 코드 변경 시 관련 문서도 함께 업데이트
   - 모두 통과 후 push

## 주요 명령어

```bash
# 개발 서버
cd backend && pnpm start:dev   # 백엔드 (8080)
cd frontend && pnpm dev        # 프론트엔드 (3000)

# 빌드
pnpm build:all                 # 전체 빌드

# 배포
pnpm deploy                    # PM2로 배포
```

## CI 검사 (push 전 필수)

> ⚠️ **push 전 필수 순서: `/ci` → PR 본문 업데이트 → 문서 업데이트 → push**

```bash
# 1. CI 검사 실행
/ci
# 2. PR 본문 업데이트 (작업 내용 명확히 기술)
# 3. 관련 문서 업데이트 (코드 변경 시)
# 4. CI 통과 확인 후 push
git push
```

`/ci` 명령어는 아래 검사를 자동으로 수행합니다:

```bash
# Backend CI
cd backend && pnpm lint && pnpm format && pnpm build && pnpm test

# Frontend CI
cd frontend && pnpm lint && pnpm format && pnpm build && pnpm test --run
```

> ⚠️ **주의사항:**
> - **push 전 `/ci` 필수** - CI 실패 시 GitHub Actions에서 PR이 거부됩니다.
> - 반드시 `cd backend &&` 또는 `cd frontend &&`를 포함해서 실행해야 합니다.
> - `pnpm test --run`은 **frontend 전용** 옵션입니다 (Vitest). backend에서 사용하면 에러 발생.
> - 프론트엔드 `pnpm test`는 watch 모드가 기본값. 한 번만 실행하려면 `--run` 옵션 필수.

## GitHub CLI 사용 가이드

**중요: MCP GitHub 도구 대신 반드시 `gh` CLI를 사용하세요.**

### 이슈 조회

```bash
# 이슈 조회 시 --json 옵션 사용 (GraphQL 에러 방지)
gh issue view <번호> --repo boostcampwm2025/web19-estrogenquattro --json title,body,state,labels

# 이슈 목록 조회
gh issue list --repo boostcampwm2025/web19-estrogenquattro --state open
```

### 이슈 생성

> **버그 이슈(`fix:`)에는 반드시 `--label "bug"` 를 붙여야 합니다.** Bug 템플릿(`@.github/ISSUE_TEMPLATE/bug.md`)을 참고하세요.

```bash
# 버그 이슈 (bug 라벨 필수)
gh issue create --repo boostcampwm2025/web19-estrogenquattro \
  --title "fix : 버그 제목" \
  --label "bug" \
  --body "$(cat <<'EOF'
## 버그 설명
> 설명

## 재현 방법
1.

## 기대 동작
>

## 실제 동작
>
EOF
)"

# 기능 이슈
gh issue create --repo boostcampwm2025/web19-estrogenquattro \
  --title "feat : 기능 제목" \
  --body "$(cat <<'EOF'
## 어떤 기능인가요?
> 설명

## 작업 상세 내용
- [ ] TODO
EOF
)"
```

### PR 조회

```bash
# PR 정보 조회 (gh api 사용 - gh pr view는 GraphQL 에러 발생)
gh api repos/boostcampwm2025/web19-estrogenquattro/pulls/<번호>

# 특정 필드만 추출
gh api repos/boostcampwm2025/web19-estrogenquattro/pulls/<번호> --template '{{.title}}'
gh api repos/boostcampwm2025/web19-estrogenquattro/pulls/<번호> --template '{{.body}}'

# PR 목록
gh pr list --repo boostcampwm2025/web19-estrogenquattro
```

### PR 생성

```bash
gh pr create --repo boostcampwm2025/web19-estrogenquattro \
  --title "feat: 기능 제목" \
  --body "$(cat <<'EOF'
## 🔗 관련 이슈
- close: #123

## ✅ 작업 내용
- 내용

## 💡 체크리스트
- [ ] PR 제목을 형식에 맞게 작성했나요?
EOF
)"
```

### Stacked PR 작성

다른 PR 위에 쌓는 Stacked PR 생성 시, **To Reviewers** 섹션에 반드시 다음 내용을 포함:

```markdown
## 💬 To Reviewers
> ⚠️ 이 PR은 [#이전PR번호](링크)의 **Stacked PR**입니다.
>
> #이전PR번호가 먼저 머지되어야 이 PR을 머지할 수 있습니다.
> **리뷰 시 `커밋해시` 커밋부터** 확인해주세요.
```

리뷰 시작 커밋 확인 방법:
```bash
git log --oneline main..HEAD  # 이 PR의 첫 번째 커밋 해시 확인
```

### PR/이슈 수정

```bash
# 이슈 본문 수정
gh issue edit <번호> --body "새 본문"

# PR 수정 (gh api 사용 - gh pr edit은 GraphQL 에러 발생)
gh api repos/boostcampwm2025/web19-estrogenquattro/pulls/<번호> -X PATCH -f title='새 제목'
gh api repos/boostcampwm2025/web19-estrogenquattro/pulls/<번호> -X PATCH -f body='새 본문'
```

> ⚠️ **`gh pr view`, `gh pr edit` 명령어 사용 금지** - deprecated된 Projects Classic GraphQL 필드로 인해 에러 발생. 반드시 `gh api` REST API 직접 호출로 우회.

### 템플릿 참조

- **Feature 이슈**: @.github/ISSUE_TEMPLATE/feature.md
- **Bug 이슈**: @.github/ISSUE_TEMPLATE/bug.md
- **PR 컨벤션**: @docs/conventions/PR_CONVENTION.md
- **커밋 컨벤션**: @docs/conventions/COMMIT_CONVENTION.md

## 주의사항

- `/auth/me` 응답: `{githubId, username, avatarUrl}`
- GitHub 폴링: GraphQL API 사용 (REST API 아님), 30초 고정 간격
- 프론트엔드 정적 빌드 → backend/public에서 서빙
