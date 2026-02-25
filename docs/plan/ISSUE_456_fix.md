# ISSUE #456 fix : 주간 리더보드 집중시간이 일별 누적시간 합산보다 크게 집계되는 문제

## 메타 정보
- Issue URL: https://github.com/boostcampwm2025/web19-estrogenquattro/issues/456
- Issue 번호: 456
- 관련 분리 이슈: https://github.com/boostcampwm2025/web19-estrogenquattro/issues/490
- 기준 브랜치: dev
- 작업 브랜치: issue-456-fix (worktree 사전 생성 브랜치, 컨벤션 예외)
- Worktree 경로: /home/fpg123/Workspace/boost/web19-estrogenquattro/.worktrees/issue-456-fix
- 작성일: 2026-02-22

## 배경/문제
주간 리더보드의 집중시간 총량이 사용자의 일별 누적 집중시간 합산보다 크게 표시됩니다.
초기 가설(미완료 과제 자정 전환 이중 집계)과 별개로, 현재 확인된 핵심 원인은
`disconnect -> startResting` 정산이 누락/실패된 뒤 재접속 시 `settleStaleSession`이 과도한 구간을 정산하는 경로입니다.

## 목표
- [x] 주간 리더보드 집중시간 계산 경로를 재현하고 과대 집계 원인을 식별한다.
- [ ] 일별 누적값 합산과 주간 집계 결과가 일치하도록 로직을 수정한다.

## 범위
### 포함
- `disconnect` 누락/실패 이후 재접속 정산 경로 점검 및 수정
- `settleStaleSession` 과다 정산 방지 로직 설계/적용
- 회귀 테스트 또는 재현 시나리오 보강

### 제외
- 리더보드 UI/디자인 개편
- 집중시간과 무관한 포인트/펫/맵 시스템 변경
- 주간 주차 경계 KST 고정 이슈 (분리: #490)
- graceful shutdown 기반 종료 시 정산 도입

## 확정 원인 요약
### 과다 집계 경로
1. 사용자가 집중 시작 후 `player.lastFocusStartTime`이 설정됨
2. `disconnect -> startResting` 경로가 누락되거나 실패함
3. 시간이 지난 뒤 재접속 시 `PlayerGateway.handleJoin`에서 `settleStaleSession` 호출
4. `settleCurrentSession`이 `lastFocusStartTime`부터 재접속 시점까지 전량 정산
5. 실제 참여 시간보다 큰 값이 `daily_focus_time`에 누적될 수 있음

### 관련 코드
- `backend/src/focustime/focustime.gateway.ts` (disconnect 시 정산 시도)
- `backend/src/player/player.gateway.ts` (`handleJoin`에서 `settleStaleSession` 호출)
- `backend/src/focustime/focustime.service.ts` (`settleStaleSession`, `settleCurrentSession`)
- `backend/src/pointhistory/point-history.service.ts` (`getHistoryRanks`에서 focus ranking 조회 위임)

## 기술 검증 근거 (웹)
- Socket.IO는 일시적 단절 동안 이벤트 손실 가능성을 명시하며, 재연결 시 자동으로 누락 이벤트를 보장하지 않음:
  - https://socket.io/docs/v4/tutorial/handling-disconnections
  - https://socket.io/docs/v4/delivery-guarantees
- Socket.IO connection state recovery는 별도 기능/설정이며 기본 전제 로직으로 가정하면 안 됨:
  - https://socket.io/docs/v4/connection-state-recovery
- NestJS Gateway lifecycle에서 disconnect 훅 기반 정리 로직은 공식 패턴:
  - https://docs.nestjs.com/websockets/gateways

위 근거에 따라 `disconnect` 정산 실패를 전제로 한 `재접속 안전 정산` 보강은 필수 범위로 유지한다.

## 재현 시나리오 (확정)
1. 10:00 집중 시작 (`startFocusing`)
2. 네트워크 단절/서버 재시작/에러로 `disconnect` 정산 미실행
3. 18:00 재접속 (`joining`)
4. `settleStaleSession` 실행 시 8시간(28,800초) 전량 누적
5. 주간 리더보드에서 사용자 체감보다 과대한 집중시간으로 표시됨

## 구현 단계
1. [x] 분석 및 재현
2. [ ] 구현
3. [ ] 테스트
4. [ ] 문서화/정리

## 구현 설계 (실현 가능성 보강)
### 변경 대상 파일 (1차)
- `backend/src/focustime/focustime.service.ts`
- `backend/src/player/player.gateway.ts` (재접속 시 `settleStaleSession` 호출 흐름 확인)
- `backend/src/focustime/focustime.service.spec.ts`
- `backend/test/focustime.e2e-spec.ts`
- `backend/src/pointhistory/point-history.service.spec.ts` (필요 시 주간 랭킹 연계 검증 보강)

### 운영 전제 (2026-02-22 업데이트)
- 실운영은 PM2를 사용하지 않는다.
- 이번 이슈 범위에서는 graceful shutdown 정산을 도입하지 않는다.
- 종료/재기동 및 강제 종료(`SIGKILL` 등) 케이스는 `재접속 stale 정산 안전장치`로 커버한다.

### 정책 정의 (구현 전 고정)
- stale 정산 허용 최대 구간은 **10분**으로 고정한다.
- 10분 초과 stale 구간은 **10분으로 클램프 후 상태 초기화**로 처리한다.
- 상한 정책은 **`settleStaleSession` 경로에만 적용**하고, 정상 `startResting` 경로에는 적용하지 않는다.

### 완료 기준
- 재현 시나리오 기준으로 일별 누적 합산과 주간 랭킹 집계 값이 일치한다.
- 기존 집중/휴식 정상 경로(`focusing -> resting`)의 정산 동작은 회귀되지 않는다.

## 리스크 및 확인 필요 사항
- 과거 과다 누적 데이터는 소급 보정하지 않기로 확정되어, 기존 랭킹 왜곡이 단기적으로 잔존할 수 있음
- `disconnect` 실패를 완전히 제거하기 어렵기 때문에, 재접속 정산의 상한/안전장치 설계가 필요
- 정산 누락 방지와 과다 정산 방지 사이의 트레이드오프 검토 필요

## 검증 계획
### 1) 단위 테스트 (`backend/src/focustime/focustime.service.spec.ts`)
- [ ] `settleStaleSession`에서 상한 정책이 적용되는 케이스를 검증한다.
- [ ] `settleStaleSession`에서 상한 정책이 적용되지 않는 정상 범위 케이스를 검증한다.
- [ ] 정상 `startResting` 경로(`focusing -> resting`)의 정산 동작이 회귀되지 않음을 검증한다.

### 2) 통합/E2E 테스트 (`backend/test/focustime.e2e-spec.ts` 중심)
- [ ] 소켓 연결 후 `focusing` 상태에서 비정상 단절(`resting` 미호출) 시나리오를 재현한다.
- [ ] 시간 경과 후 재접속(`joining`) 시 `joined.focusTime` 값이 상한 정책과 일치하는지 검증한다.
- [ ] 동일 데이터 기준 `GET /api/history-ranks?type=FOCUSED&weekendStartAt=...` 결과와 일별 누적 합산이 일치하는지 검증한다.

### 3) 수동 시나리오
- [ ] 브라우저/탭 환경에서 네트워크 단절 또는 **실운영 재기동 방식**으로 서버 재시작 후 재접속 절차를 수행한다.
- [ ] 리더보드 집중시간과 일별 누적시간 합산을 비교한다.
- [ ] 허용 오차(초 단위)와 합격 기준을 기록한다.

### 검증 기준 (Exit Criteria)
- [ ] 재현 케이스에서 과대 누적 재발 0건
- [ ] 정상 세션(`focusing -> resting`) 정산 회귀 0건
- [ ] 주간 랭킹 집계와 일별 누적 합산 불일치 재발 0건

## 문서 동기화 대상 (코드-문서 매핑 기준)
- [ ] `docs/features/FOCUS_TIME.md`
- [ ] `docs/features/FOCUS_TIME_DETAIL.md`
- [ ] `docs/api/SOCKET_EVENTS.md`

## 정책 확정 체크리스트 (구현 전 결정)
- [x] stale 정산 허용 최대 구간(N분)을 수치로 확정한다. (10분)
- [x] 허용 구간 초과 시 처리 방식을 확정한다. (10분 클램프)
- [x] 상한 정책 적용 범위를 확정한다. (`settleStaleSession`만 적용)
- [x] graceful shutdown 정산 적용 여부와 실패 시 폴백 정책을 확정한다. (미적용, stale 안전장치로 대응)
- [x] 과거 과다 누적 데이터 보정 방식(미수정 / 배치 보정 / 수동 보정)을 확정한다. (소급 보정 없음)

## 배포/롤백 및 관측
### 배포 후 관측 항목
- [ ] 재접속 직후 `joined.focusTime.totalFocusSeconds` 급증 사례 수
- [ ] `history-ranks(type=FOCUSED)` 결과와 일별 누적 합산 불일치 사례 수
- [ ] 정상 `focusing -> resting` 경로의 평균 정산 시간 분포 변화

### 롤백 조건
- [ ] 배포 후 과대 누적 재발이 확인되면 즉시 롤백한다.
- [ ] 정상 세션 정산 누락(과소 집계) 회귀가 확인되면 롤백한다.
- [ ] 일별 합산 대비 주간 집계 불일치가 지속되면 롤백한다.
