# PR (Pull Request)

## PR 작성 원칙

- 서로의 성장을 위해 **리뷰를 적극적으로 작성합니다**.
- PR은 **하나의 기능 또는 하나의 버그 단위**로 생성합니다.

## 코드 리뷰 수칙

- PR 생성 후 **다음 날 오전 10시 전까지** 리뷰를 남깁니다.
- 단순 의견뿐 아니라 **이유와 개선 방향을 함께 공유**합니다.

## 머지(Merge) 규칙

- **2명 이상 Approve** 시 머지가 가능합니다.
- **리뷰 없는 머지는 허용하지 않습니다**.

## PR 템플릿

```markdown
<!-- PR 제목 예시 : feat: 로그인 기능 구현 -->
<!-- PR 제목은 위 형식을 참고하여 작성해주세요. -->
<!-- 필요 없는 내용은 지우고 작성해주세요 -->

## 🔗 관련 이슈

- close: #

## ✅ 작업 내용

<!-- 구현한 기능이나 수정한 내용을 상세히 기술해주세요. -->
<!-- 변경 내용과 관련 파일을 함께 작성합니다. -->
<!-- 예시:
- CI 워크플로우 추가 (`backend-ci.yml`, `frontend-ci.yml`)
- PR 자동 assignee/reviewer 지정 워크플로우 추가 (`auto-assign.yml`)
- Backend lint/format 스크립트 분리 (`package.json`)
- Backend 코드 포맷팅 및 린트 경고 수정
-->

-
-

## 📸 스크린샷 / 데모 (옵션)

<!-- UI 변경사항이나 새로운 기능의 동작을 시각적으로 보여주세요. -->

## 🧪 테스트 (옵션)

<!-- 테스트를 추가했다면 아래 형식으로 작성해주세요. -->
<!-- 예시:
| 테스트 방식 | 파일 | 테스트 케이스 |
|------------|------|--------------|
| FakeSocket | `socket-manager.spec.ts` | focus_task_updated 이벤트 수신 시 updateTaskBubble 호출 |
| MSW | `tasks.api.spec.ts` | Task 생성 시 스토어에 반영 |
| E2E Socket | `focustime.e2e-spec.ts` | joined 이벤트에 focusTime 포함 |
-->

## 💡 체크리스트

<!-- PR을 제출하기 전에 아래 항목들을 확인해주세요. -->
- [ ] PR 제목을 형식에 맞게 작성했나요?
- [ ] 브랜치 전략에 맞는 브랜치에 PR을 올리고 있나요? (예: `feature/login` -> `develop`)

## 💬 To Reviewers
<!-- 리뷰어에게 전달하고 싶은 내용이나 특별히 확인이 필요한 부분을 작성해주세요. -->
```

---

## PR 본문 작성 안전 가이드 (CLI)

백틱(`)이 포함된 PR 본문을 쉘 인자로 직접 넘기면, 쉘이 이를 **명령 치환**으로 해석해 명령이 깨질 수 있습니다.

### 금지 패턴

```bash
# 백틱/특수문자 포함 시 깨질 수 있음
gh pr create --title "..." --body "본문에 `code` 포함"
```

### 권장 패턴

1. 본문은 먼저 파일로 작성한다. (`<<'EOF'` 사용)
2. `gh pr create --body-file` 또는 `gh pr edit --body-file`만 사용한다.
3. 생성/수정 직후 본문을 조회해 검증한다.

```bash
# 1) 본문 작성
cat > /tmp/pr_body.md <<'EOF'
## 🔗 관련 이슈
- close: #123

## ✅ 작업 내용
- `code` 블록/백틱/특수문자가 있어도 안전하게 보존된다.
EOF

# 2) 생성
gh pr create \
  --repo boostcampwm2025/web19-estrogenquattro \
  --base main \
  --head <branch> \
  --title "fix: ..." \
  --body-file /tmp/pr_body.md

# 3) 수정
gh pr edit <pr_number> --body-file /tmp/pr_body.md

# 4) 검증
gh pr view <pr_number> --json body --jq .body | sed -n '1,80p'
```

---

## PR 본문 업데이트

PR 본문을 CLI로 수정하려면 아래 명령어를 사용합니다:

```bash
gh pr edit {pr_number} --body-file /tmp/pr_body.md
```

**예시:**

```bash
cat > /tmp/pr_body.md <<'EOF'
## 작업 내용
- 기능 A 추가
- 버그 B 수정
EOF

gh pr edit 22 --body-file /tmp/pr_body.md
```
