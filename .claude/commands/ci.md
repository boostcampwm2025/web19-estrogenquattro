# CI 검사 및 자동 수정

변경된 파일을 감지하여 해당 프로젝트의 CI를 실행하고, 오류 발생 시 자동으로 수정합니다.

## 1단계: 변경 파일 감지

```bash
git diff --name-only main...HEAD
```

변경 파일이 없으면:
```bash
git diff --name-only
```

결과에서:
- `backend/` 경로 포함 → Backend CI 필요
- `frontend/` 경로 포함 → Frontend CI 필요
- 둘 다 없음 (docs 등만 변경) → CI 스킵

## 2단계: CI 실행 (병렬)

**중요: Backend CI와 Frontend CI를 병렬로 실행하세요.**

둘 다 변경된 경우, 두 CI를 동시에 시작합니다.

### Backend CI (backend/ 변경 시)

순서대로 실행:
```bash
cd backend && pnpm lint && pnpm format && pnpm build && pnpm test
```

> **Note:** `app.module.spec.ts`에서 AppModule 컴파일 테스트를 수행하여 DI 오류를 감지합니다.

실패 시:
- lint 실패 → `pnpm lint:fix` 후 재실행
- format 실패 → `pnpm format:fix` 후 재실행
- build/test 실패 → 에러 분석 후 코드 수정
- AppModule 테스트 실패 → 모듈 imports/exports 확인

### Frontend CI (frontend/ 변경 시)

순서대로 실행:
```bash
cd frontend && pnpm lint && pnpm format && pnpm build && pnpm test --run
```

실패 시:
- lint 실패 → `pnpm lint:fix` 후 재실행
- format 실패 → `pnpm format:fix` 후 재실행
- build/test 실패 → 에러 분석 후 코드 수정

## 3단계: 결과 보고

- 감지된 변경 폴더
- 실행된 CI 항목
- 자동 수정된 내용
- 최종 CI 통과 여부
