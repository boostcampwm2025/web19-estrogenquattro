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

## 💡 체크리스트

<!-- PR을 제출하기 전에 아래 항목들을 확인해주세요. -->
- [ ] PR 제목을 형식에 맞게 작성했나요?
- [ ] 브랜치 전략에 맞는 브랜치에 PR을 올리고 있나요? (예: `feature/login` -> `develop`)

## 💬 To Reviewers
<!-- 리뷰어에게 전달하고 싶은 내용이나 특별히 확인이 필요한 부분을 작성해주세요. -->
```

---

## PR 본문 업데이트

PR 본문을 CLI로 수정하려면 아래 명령어를 사용합니다:

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number} -X PATCH -f body='새로운 본문 내용'
```

**예시:**

```bash
gh api repos/boostcampwm2025/web19-estrogenquattro/pulls/22 -X PATCH -f body='## 작업 내용
- 기능 A 추가
- 버그 B 수정'
```
