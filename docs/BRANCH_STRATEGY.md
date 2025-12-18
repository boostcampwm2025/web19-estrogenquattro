# 브랜치 전략

## main 머지 전략

- `main` 브랜치에는 **Squash Merge**만 허용합니다.
- 커밋 히스토리를 단순하게 유지하여 변경 이력을 명확히 관리

## 브랜치 네이밍

- `main`: 기본 브랜치
- 작업 브랜치 네이밍 규칙
    - `{타입}/#이슈번호-작업내용`

### 브랜치 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| feat | 새로운 기능 추가 | `feat/#12-login` |
| fix | 버그 수정 | `fix/#34-button-click` |
| refactor | 코드 리팩토링 | `refactor/#56-api-client` |
| docs | 문서 작업 | `docs/#78-readme` |
| test | 테스트 코드 | `test/#90-unit-test` |
| setting | 환경 설정, CI/CD, 빌드 설정 | `setting/#18-ci-setup` |
| chore | 기타 작업 | `chore/#11-cleanup` |
