# Merge 충돌 해결

`origin/main`을 현재 브랜치에 merge하고, 충돌 발생 시 문서와 PR 컨텍스트를 분석하여 해결 방안을 제안합니다.

## 사용법

- `/resolve-conflicts` - origin/main을 merge하고 충돌 해결

## 컨벤션 참조

| 항목 | 참조 문서 |
|------|----------|
| 브랜치 네이밍 | @docs/conventions/BRANCH_STRATEGY.md |
| 커밋 메시지 | @docs/conventions/COMMIT_CONVENTION.md |
| PR 작성 | @docs/conventions/PR_CONVENTION.md |

---

## 실행 단계

### 1단계: 현재 브랜치 정보 수집

```bash
# 현재 브랜치명 확인
git branch --show-current
```

**브랜치명에서 이슈 번호 추출:**

@docs/conventions/BRANCH_STRATEGY.md 규칙에 따라 `{타입}/#이슈번호-작업내용` 형식에서 추출

| 브랜치 형식 | 이슈 번호 추출 |
|------------|---------------|
| `feat/#123-login` | 123 |
| `fix/#456-button-click` | 456 |
| `refactor/#789-api-client` | 789 |
| `docs/#101-readme` | 101 |
| `test/#202-unit-test` | 202 |
| `setting/#303-ci-setup` | 303 |
| `chore/#404-cleanup` | 404 |

### 2단계: 관련 문서 로드

**이슈 번호가 추출되면:**

1. **docs/plan 문서 검색**
   ```bash
   # ISSUE_{번호}_ 패턴으로 검색
   ls docs/plan/ | grep -i "ISSUE_{이슈번호}_"
   ```

   예: 이슈 #362 → `docs/plan/ISSUE_362_*.md` 파일 읽기

2. **현재 브랜치의 PR 조회**
   ```bash
   gh pr list --repo boostcampwm2025/web19-estrogenquattro --head {브랜치명} --json number,title,body
   ```

3. **GitHub 이슈 조회**
   ```bash
   gh issue view {이슈번호} --repo boostcampwm2025/web19-estrogenquattro --json title,body,state,labels
   ```

### 3단계: origin/main fetch 및 merge 시도

```bash
git fetch origin main
git merge origin/main --no-edit
```

**충돌 없음:** "origin/main과 성공적으로 병합되었습니다" 출력 후 종료

**충돌 발생:** 다음 단계로 진행

### 4단계: 충돌 파일 분석

```bash
# 충돌 파일 목록
git diff --name-only --diff-filter=U

# 각 충돌 파일의 내용 확인
git diff {파일경로}
```

각 충돌 파일에 대해:

1. **현재 브랜치(ours) 변경 내용 확인**
   ```bash
   git log --oneline main..HEAD -- {파일경로}
   ```

2. **main 브랜치(theirs) 변경 내용 확인**
   ```bash
   git log --oneline HEAD..origin/main -- {파일경로}
   ```

3. **main의 관련 커밋이 속한 PR 조회**
   ```bash
   # main에 머지된 PR 중 해당 파일을 수정한 PR 검색
   gh api repos/boostcampwm2025/web19-estrogenquattro/commits/{커밋해시}/pulls --jq '.[0] | {number, title, body}'
   ```

### 5단계: 충돌 해결 방안 분석

각 충돌 파일에 대해 다음을 분석:

| 분석 항목 | 소스 |
|----------|------|
| 현재 브랜치 의도 | `docs/plan/ISSUE_{번호}_*.md`, 현재 PR 본문, GitHub 이슈 |
| main 브랜치 의도 | 머지된 PR 본문, 커밋 메시지 |
| 충돌 내용 | `git diff` 결과 |

### 6단계: 해결 방안 제안

충돌별로 다음 형식으로 제안:

```markdown
## 충돌 해결 제안

### 파일: {충돌파일경로}

#### 충돌 내용
```diff
(충돌 diff 내용)
```

#### 현재 브랜치 (ours) 컨텍스트
- **이슈**: #{이슈번호}
- **브랜치**: {브랜치명}
- **목적**: (docs/plan 문서 또는 이슈에서 추출한 목적)
- **관련 커밋**: (커밋 목록)

#### main 브랜치 (theirs) 컨텍스트
- **PR**: #{PR번호} - {PR제목}
- **목적**: (PR 본문에서 추출한 목적)
- **관련 커밋**: (커밋 목록)

#### 제안하는 해결 방법
1. (구체적인 해결 방법)
2. (코드 변경 내용)

#### 해결 코드
```{언어}
(제안하는 최종 코드)
```
```

사용자에게 **AskUserQuestion**으로 확인:
- "제안대로 해결"
- "직접 수정하겠습니다"
- "다른 방법 제안"

### 7단계: 충돌 해결 적용 (승인 시)

사용자가 "제안대로 해결" 선택 시:

1. **충돌 파일 수정**
   - 제안한 코드로 파일 수정
   - `<<<<<<<`, `=======`, `>>>>>>>` 마커 제거

2. **staging에 추가**
   ```bash
   git add {충돌파일경로}
   ```

3. **모든 충돌 해결 후 merge 커밋**

   @docs/conventions/COMMIT_CONVENTION.md 참고하여 커밋:

   ```bash
   git commit -m "merge: origin/main 병합 및 충돌 해결

   Resolved conflicts:
   - {파일1}: {해결 요약}
   - {파일2}: {해결 요약}
   "
   ```

### 8단계: PR 코멘트 작성

```bash
# 현재 브랜치의 PR 번호 조회
gh pr list --repo boostcampwm2025/web19-estrogenquattro --head {브랜치명} --json number -q '.[0].number'
```

PR이 존재하면 충돌 해결 내용을 코멘트로 기록:

```bash
gh pr comment {PR번호} --repo boostcampwm2025/web19-estrogenquattro --body "$(cat <<'EOF'
## 🔀 Merge 충돌 해결

`origin/main` 병합 중 발생한 충돌을 해결했습니다.

### 해결된 충돌

| 파일 | 해결 방법 |
|------|----------|
| `{파일1}` | {해결 요약} |
| `{파일2}` | {해결 요약} |

### 상세 내용

#### `{파일1}`
- **ours (이 PR)**: {변경 목적}
- **theirs (main)**: {변경 목적} (PR #{main쪽PR번호})
- **해결**: {어떻게 병합했는지}

(필요시 추가 파일...)

---
🤖 Resolved by `/resolve-conflicts`
EOF
)"
```

### 9단계: Push

```bash
git push
```

### 10단계: 결과 출력

```markdown
## 충돌 해결 완료

### 병합 정보
- **브랜치**: {현재브랜치} (이슈 #{이슈번호})
- **base**: origin/main
- **커밋**: {merge 커밋 해시}

### 참조한 문서
- `docs/plan/ISSUE_{번호}_{설명}_{날짜}.md`
- PR #{현재PR번호} 본문
- 이슈 #{이슈번호}

### 해결된 충돌
| 파일 | ours 목적 | theirs 목적 (PR) | 해결 방법 |
|------|----------|-----------------|----------|
| `{파일1}` | {요약} | {요약} (#{PR번호}) | {요약} |

### PR 업데이트
- PR #{PR번호}에 충돌 해결 코멘트 추가됨

### 다음 단계
- `/ci` 실행하여 CI 검증
```

---

## 충돌 해결 전략

### 전략 우선순위

1. **양쪽 변경 모두 유지 가능한 경우**
   - 두 변경이 서로 다른 영역이면 모두 포함

2. **기능적으로 호환 가능한 경우**
   - 두 변경을 조합하여 통합

3. **한쪽을 선택해야 하는 경우**
   - docs/plan 문서와 PR 분석 결과를 바탕으로 판단
   - 더 최신이거나 더 완성도 높은 변경 선택
   - 선택하지 않은 쪽의 의도가 손실되지 않도록 주의

4. **판단이 어려운 경우**
   - 사용자에게 명확히 선택지 제시
   - 각 선택의 영향도 설명

### 특수 케이스

| 파일 유형 | 처리 방법 |
|----------|----------|
| `package.json` | 의존성은 양쪽 모두 유지, scripts는 신중히 병합 |
| `pnpm-lock.yaml` | theirs(main) 우선 후 `pnpm install` 재실행 |
| `*.entity.ts` | @docs/guides/ERD.md 참고하여 병합 |
| 마이그레이션 | 타임스탬프 확인, 순서 보장 |
| 설정 파일 | 양쪽 설정 모두 필요한지 확인 |

---

## 주의사항

- **merge 전 로컬 변경사항 커밋 필수**: uncommitted 변경이 있으면 먼저 commit 또는 stash
- **복잡한 충돌은 신중히**: 자동 해결이 위험하다 판단되면 사용자에게 직접 수정 권유
- **테스트 필수**: 충돌 해결 후 반드시 `/ci` 실행
- **main 브랜치에서 실행 금지**: 작업 브랜치에서만 실행
