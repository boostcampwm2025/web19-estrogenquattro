# Issue #459: i18next 타입 안전성 + Selector API 적용

> 작성일: 2026-02-11
> 관련 PR: #458
> 상태: 완료

## 배경

기존 번역 키가 `t("userInfoModal.activity.heatmap.policies.commit")` 같은 raw string으로 사용되어 오타나 키 변경 시 런타임에서야 발견됨.

## 목표

- i18next v25.4+의 `CustomTypeOptions` + `enableSelector: "optimize"` 적용
- 컴파일 타임 타입 체크 확보
- IDE 자동완성 / Go-to-definition 지원

## 변경 사항

### 1. i18n 설정 업데이트

**파일:** `frontend/src/i18n/index.ts`

- `defaultNS`, `resources`를 named export로 변경 (타입 선언에서 참조)
- `as const` 적용으로 리터럴 타입 보존

### 2. 타입 선언 파일 생성

**신규 파일:** `frontend/src/i18n/i18next.d.ts`

```typescript
import "i18next";
import { resources, defaultNS } from "./index";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)["ko"];
    enableSelector: "optimize";
  }
}
```

- `enableSelector: "optimize"` → `t()` 함수가 셀렉터 함수만 받도록 강제
- 대규모 번역 셋에서도 IDE 성능 저하 없음

### 3. 정적 키 셀렉터 변환 (15개 파일, 37개 호출)

```typescript
// Before
t("focusPanel.collapsePanel")

// After
t($ => $.focusPanel.collapsePanel)
```

interpolation이 있는 경우:
```typescript
// Before
t("userInfoModal.activity.heatmap.tooltipPoint", { value: day.value })

// After
t($ => $.userInfoModal.activity.heatmap.tooltipPoint, { value: day.value })
```

### 4. 동적 키 타입 안전성 확보 (3개 파일)

`enableSelector: "optimize"` 적용 시 문자열 키 사용 불가 → bracket access 패턴으로 전환.

**4-1. HeatmapInfo.tsx** - 포인트 정책 목록

```typescript
// Before: 전체 경로를 문자열로 저장
const POINT_POLICIES = [
  { actionKey: "userInfoModal.activity.heatmap.policies.commit", points: 2 },
];
t(policy.actionKey)

// After: 리프 키만 저장 + bracket access
const POINT_POLICIES = [
  { policyKey: "commit", points: 2 },
] as const;
t($ => $.userInfoModal.activity.heatmap.policies[policy.policyKey])
```

**4-2. GitEventDetail.tsx** - 이벤트 타입 라벨/헤더

```typescript
// Before: Record<string, string>으로 전체 경로 저장
const EVENT_TYPE_LABEL_KEY: Record<string, string> = {
  [GIT_EVENT_TYPES.COMMITTED]: "userInfoModal.activity.gitEvent.label.committed",
};

// After: as const + 리프 키 + props 타입 좁히기
const EVENT_TYPE_LABEL_KEY = {
  [GIT_EVENT_TYPES.COMMITTED]: "committed",
} as const;
t($ => $.userInfoModal.activity.gitEvent.label[EVENT_TYPE_LABEL_KEY[selectedCard]])
```

- `GitEventDetailProps.selectedCard` 타입을 `StatCardType` → `GitEventType`으로 좁힘
- `GIT_EVENT_TYPE_MAP` 제거 (identity map이었으므로 불필요)

**4-3. constants.ts (STAT_CARD_CONFIG)**

```typescript
// Before: 전체 경로
{ titleKey: "userInfoModal.activity.statCards.focusTime" }

// After: 리프 키
{ titleKey: "focusTime" }
```

- `StatCardData.titleKey` 타입을 `string` → `StatCardTitleKey` (리터럴 유니온)으로 변경

## 수정 파일 목록

| 파일 | 작업 |
|------|------|
| `src/i18n/index.ts` | 설정 업데이트 |
| `src/i18n/i18next.d.ts` | 신규 생성 |
| `src/app/_components/FocusPanel/FocusPanel.tsx` | 셀렉터 변환 |
| `src/app/_components/MusicPlayer/MusicPlayerContent.tsx` | 셀렉터 변환 |
| `src/app/_components/TasksMenu/TaskItem.tsx` | 셀렉터 변환 |
| `src/app/_components/TasksMenu/TaskList.tsx` | 셀렉터 변환 |
| `src/app/_components/TasksMenu/TasksMenuContent.tsx` | 셀렉터 변환 |
| `src/app/_components/TasksMenu/TaskTimer.tsx` | 셀렉터 변환 |
| `src/app/_components/UserInfoModal/index.tsx` | 셀렉터 변환 |
| `src/app/_components/UserInfoModal/tabs/ActivityTab/ActivityTab.tsx` | 셀렉터 변환 |
| `src/app/_components/UserInfoModal/tabs/ActivityTab/components/CalendarHeatmap/HeatmapInfo.tsx` | 셀렉터 + as const |
| `src/app/_components/UserInfoModal/tabs/ActivityTab/components/CalendarHeatmap/HeatmapLegend.tsx` | 셀렉터 변환 |
| `src/app/_components/UserInfoModal/tabs/ActivityTab/components/CalendarHeatmap/HeatmapTooltip.tsx` | 셀렉터 변환 |
| `src/app/_components/UserInfoModal/tabs/ActivityTab/components/DetailSection/GitEventDetail.tsx` | 셀렉터 + as const + 타입 좁히기 |
| `src/app/_components/UserInfoModal/tabs/ActivityTab/components/StatsSection/StatsSection.tsx` | 셀렉터 변환 |
| `src/app/_components/UserInfoModal/tabs/ActivityTab/components/TaskSection/TaskSection.tsx` | 셀렉터 변환 |
| `src/app/_components/UserInfoModal/tabs/ActivityTab/constants/constants.ts` | titleKey 리프 키 변경 |
| `src/app/_components/UserInfoModal/tabs/ActivityTab/types/types.ts` | titleKey 타입 좁히기 |
| `src/app/_components/UserInfoModal/tabs/ProfileTab/ProfileTab.tsx` | 셀렉터 변환 |

## 검증

- `pnpm build` — 타입 에러 없이 빌드 성공
- `pnpm test --run` — 32개 파일, 319개 테스트 통과
- 수동 테스트 — ko/en 언어 전환 시 모든 텍스트 정상 표시
