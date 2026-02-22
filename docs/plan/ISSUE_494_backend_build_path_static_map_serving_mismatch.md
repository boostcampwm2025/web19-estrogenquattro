# ISSUE #494 백엔드 빌드 경로 변경으로 정적/맵 파일 서빙 경로가 불일치하는 문제

## 메타 정보
- Issue URL: https://github.com/boostcampwm2025/web19-estrogenquattro/issues/494
- Issue 번호: 494
- 기준 브랜치: origin/dev
- 작업 브랜치: fix/#494-backend-build-path-static-map-serving-mismatch
- Worktree 경로: /home/fpg123/Workspace/boost/web19-estrogenquattro/.worktrees/fix/#494-backend-build-path-static-map-serving-mismatch
- 작성일: 2026-02-22

## 배경/문제
`backend` 빌드 산출 경로가 `dist/main.js`에서 `dist/src/main.js`로 바뀌면서 런타임 경로 계산 기준이 깨져 연쇄 404가 발생한다.

- `GET /` 요청 시 `backend/dist/public/index.html`를 찾다가 `ENOENT` 발생
- `GET /api/maps/0` 요청 시 `backend/dist/assets/maps/...`를 찾다가 `Map file not found` 발생
- 원인 후보:
  - `tsconfig.build.json`에서 `load-test` 경로 미제외로 컴파일 루트 확장
  - `__dirname` 상대 경로 기반 정적/에셋 경로 계산으로 엔트리 위치 변화에 취약

## 목표
- [x] 빌드 산출 경로를 의도한 엔트리 구조로 안정화한다.
- [x] 빌드 산출 경로 복구만으로 `GET /`, `GET /api/maps/0`의 404/ENOENT를 제거한다.
- [x] 완료 기준(DoD): `dist/main.js`가 복구되고 `GET /` 및 `GET /api/maps/0`에서 404/ENOENT가 재발하지 않는다.

## 의사결정 확정 사항
- 표준 백엔드 엔트리 경로는 `dist/main.js`로 고정한다.
- 이번 이슈의 필수 범위는 **빌드 출력 경로 안정화(1번)** 까지로 제한한다.
- 런타임 경로 계산 기준 통일(`process.cwd()`/`ASSETS_PATH` 정책)은 이번 이슈에서 보류하고, 1번 적용 후에도 재발할 때 후속 이슈로 분리한다.

## 범위
### 포함
- `backend` 빌드 출력 경로(`tsconfig.build.json`의 `load-test` 제외 또는 `rootDir` 명시) 점검 및 고정
- PM2 실행 엔트리와 실제 빌드 산출물(`dist/main.js`) 일치성 검증
- `docs/guides/DEPLOYMENT.md`의 PM2 `script` 경로 설명과 실제 빌드 산출물 동기화
- `docs/guides/DEVELOPMENT.md`의 실행/빌드 경로 설명 점검 및 필요 시 수정

### 제외
- GitHub 폴링/포인트/게임 로직 변경
- 신규 기능 추가 또는 UI 변경
- 인프라 구조 개편
- 런타임 경로 계산 기준 통일(`process.cwd()` 전환, `ASSETS_PATH` 정책 변경)

## 구현 단계
### 1) 분석 및 재현
- [x] `pnpm --filter backend exec tsc -p tsconfig.build.json --listFilesOnly`로 현재 빌드 입력(`load-test` 포함 여부) 확인
- [x] 빌드 산출 엔트리 위치(`dist/main.js`, `dist/src/main.js`) 및 PM2 실행 경로 불일치 여부 확인
- [x] `GET /`, `GET /api/maps/0` 실패 로그(ENOENT/Map file not found) 재현 및 기준 로그 확보

### 2) 구현
- [x] `backend/tsconfig.build.json`에서 빌드 입력 경로 정리(`load-test` 제외 또는 `rootDir` 명시)
- [x] 빌드 산출 엔트리가 `dist/main.js`로 복구되는지 확인
- [x] PM2 `cwd`/`script`와 실제 백엔드 엔트리 정합성 보정(`ecosystem.config.js`, `backend/package.json`)

### 3) 테스트
- [x] 실서비스 유사/통합(E2E)/수동 시나리오 검증 수행 및 결과 기록

### 4) 문서화/정리
- [x] `docs/guides/DEPLOYMENT.md`, `docs/guides/DEVELOPMENT.md`, `docs/architecture/TECH_STACK.md` 동기화
- [x] 변경 요약과 검증 결과를 계획 문서 체크리스트에 반영

## 영향 파일(예상)
- `backend/tsconfig.build.json`
- `ecosystem.config.js`
- `backend/package.json` (`start:prod` 엔트리 점검)
- `docs/guides/DEPLOYMENT.md`
- `docs/guides/DEVELOPMENT.md`
- `docs/architecture/TECH_STACK.md`

## 리스크 및 확인 필요 사항
- `origin/dev` 원격 fetch는 실패했고 로컬 추적 ref(`origin/dev`) 기준으로 worktree를 생성했으므로, 원격 기준점 최신성 확인이 필요함
- PM2 `script`/`cwd` 설정과 빌드 출력 경로가 환경별로 일관적인지 확인 필요
- 빌드 출력 경로 복구 후에도 404가 재현되면 런타임 경로 계산 기준 통일 이슈를 후속으로 분리해야 함

## 검증 계획
### 1) 실서비스 유사 검증 (최우선)
- [x] `pnpm --filter backend exec tsc -p tsconfig.build.json --listFilesOnly` 결과에 `load-test/` 경로가 제외되었는지 확인
- [x] 백엔드 빌드 후 PM2 `script` 경로와 실제 엔트리 파일 존재 여부(`dist/main.js`) 확인
- [x] 백엔드 실행 후 `GET /`가 200을 반환하고 정적 `index.html`을 정상 서빙하는지 확인
- [x] 백엔드 실행 후 `GET /api/maps/0` 정상 응답, 미허용 인덱스/없는 파일 케이스에서 의도된 오류(403/404)가 반환되는지 확인

### 2) 통합/E2E 검증
- [x] 이슈 범위 한정으로 빌드 경로/정적 서빙/맵 서빙 회귀를 통합 테스트로 검증
- [x] 필요 시 `pnpm --filter backend test:e2e --runInBand`로 기존 E2E 회귀 영향 확인 (전체 타입 에러와 분리 가능한 범위 우선)

### 3) 수동 시나리오 검증
- [x] 브라우저에서 루트 진입 시 초기 화면 로딩 확인 (404/ENOENT 재발 여부)
- [x] 실제 게임 진입 시 맵 이미지 로딩 확인 (`/api/maps/:index` 네트워크 요청 기준)

### 4) 문서-코드 정합성 검증
- [x] `ecosystem.config.js`, `backend/tsconfig.build.json`, `docs/guides/DEPLOYMENT.md` 간 경로 정의 일치 여부 확인
- [x] 필요 시 `docs/guides/DEVELOPMENT.md`, `docs/architecture/TECH_STACK.md`까지 동기화

### 통과 기준
- [x] 실서비스 유사 검증(1) 필수 항목 전부 통과
- [x] 통합/E2E(2)에서 경로/서빙 관련 신규 실패 없음
- [x] 수동 시나리오(3)에서 404 재발 없음
- [x] 문서-코드 정합성(4) 반영 완료

## 실행 결과 요약 (2026-02-22)

### 코드 변경
- `backend/tsconfig.build.json`
  - `compilerOptions.rootDir`를 `./src`로 고정
  - `exclude`에 `load-test` 추가

### 핵심 검증 로그
- 수정 전(`dist/src/main.js` 기준)
  - `pnpm --filter backend exec tsc -p tsconfig.build.json --listFilesOnly`에 `backend/load-test/...` 포함
  - 빌드 산출물이 `backend/dist/src/main.js`로 생성
  - `GET /api/maps/0` 시 `Map file not found`, 경로가 `backend/dist/assets/maps/...`로 로깅됨
- 수정 후(`dist/main.js` 기준)
  - `pnpm --filter backend exec tsc -p tsconfig.build.json --listFilesOnly`에서 `load-test` 제외
  - 빌드 산출물이 `backend/dist/main.js`로 복구
  - `pm2` 설정(`cwd: ./backend`, `script: dist/main.js`) 및 `start:prod(node dist/main)` 실행 경로 정합성 확인
  - `GET /` 200 확인(검증용 `backend/public/index.html` 임시 파일 기준)
  - `GET /api/maps/0` 200 확인, `GET /api/maps/1` 403, `GET /api/maps/99` 404 확인

### 테스트 실행 결과
- `pnpm --filter backend test:e2e --runInBand` → PASS (8 suites, 29 tests)

### 문서 동기화 결과
- `docs/guides/DEPLOYMENT.md`, `docs/guides/DEVELOPMENT.md`, `docs/architecture/TECH_STACK.md`의 `dist/main.js` 기준 설명이 코드와 이미 일치하여 추가 수정 없음

### 검증 시 참고사항
- 현재 worktree 경로에 `#` 문자가 포함되어 `res.sendFile` 경로 처리에 환경 의존 이슈가 있어, 맵 200 검증은 `ASSETS_PATH=/tmp/issue494-assets`(동일 자산에 대한 심볼릭 링크)로 보조 검증함
- 기본 경로 계산 자체는 수정 후 로그에서 `backend/assets/...`로 확인됨 (`MAP_THEME=ghost`에서 `Map file not found` 경로 확인)
