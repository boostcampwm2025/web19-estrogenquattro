# Calendar Heatmap 성능 최적화

## 개요

CalendarHeatmap 컴포넌트의 렌더링 성능을 개선하여 마우스 인터랙션 시 불필요한 리렌더링을 방지했습니다.

## 문제점

### Before (최적화 전)

1. **전체 셀 리렌더링 문제**
   - 마우스를 히트맵 위에서 드래그할 때마다 365개의 모든 셀이 리렌더링
   - 초당 수십~수백 번의 불필요한 렌더링 발생

2. **성능 지표** (React DevTools Profiler 측정)
   - 평균 렌더링 시간: 58.0ms
   - 렌더링 시간 범위: 53.6ms ~ 64.9ms
   - 마우스 인터랙션: 버벅거림 발생

## 해결 방법

### 1. HeatmapCell에 React.memo 적용

**파일**: `HeatmapCell.tsx`

```typescript
import { memo } from "react";

export const HeatmapCell = memo(function HeatmapCell({
  day,
  selectedDate,
  onSelectDate,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}: HeatmapCellProps) {
  // ...
});
```

**효과**:
- props가 변경되지 않은 셀은 리렌더링 스킵
- 365개 셀 중 실제로 변경된 셀만 렌더링

### 2. 이벤트 핸들러 useCallback으로 메모이제이션

**파일**: `CalendarHeatmap.tsx`

```typescript
import { useCallback, startTransition } from "react";

const handleMouseMove = useCallback((e: React.MouseEvent, day: DayData) => {
  if (day.value === -1) return;
  startTransition(() => {
    setHoveredDay(day);
    setMousePosition({ x: e.clientX, y: e.clientY });
  });
}, []);

const handleMouseLeave = useCallback(() => {
  setHoveredDay(null);
}, []);
```

**효과**:
- 함수 참조가 유지되어 React.memo가 제대로 작동
- 부모 컴포넌트 리렌더링 시에도 핸들러 함수가 재생성되지 않음

## 결과

### After (최적화 후)

**성능 측정 환경**:
- 브라우저: Chrome
- 측정 도구: React DevTools Profiler
- 측정 방법: 5-6회 렌더링 측정 후 평균 계산

**성능 지표**:
| 항목 | Before | After | 개선율 |
|------|--------|-------|--------|
| 평균 렌더링 시간 | 58.0ms | 40.7ms | **29.8% ↓** |
| 최선의 경우 | 53.6ms | 35.2ms | **34.3% ↓** |
| 최악의 경우 | 64.9ms | 46.7ms | **28.3% ↓** |

**상세 측정 결과**:
- Before: 55.6ms, 56.5ms, 64.9ms, 53.6ms, 59.4ms (평균 58.0ms)
- After: 37.8ms, 37.2ms, 46.5ms, 35.2ms, 46.7ms, 40.5ms (평균 40.7ms)

**사용자 경험**:
- 마우스 드래그 시 부드러운 인터랙션
- hover된 셀만 리렌더링 (365개 → 1개)
- 버벅거림 현상 해결
- 툴팁 표시가 다른 UI 업데이트를 차단하지 않음

## 적용된 최적화 기법

### 1. React.memo (Rule 5.2)

컴포넌트의 props가 변경되지 않으면 리렌더링을 스킵하는 고차 컴포넌트(HOC)

**사용 시기**:
- 자식 컴포넌트가 많을 때 (예: 365개 셀)
- props가 자주 변경되지 않을 때
- 렌더링 비용이 높을 때

**주의사항**:
- props로 전달되는 함수는 useCallback으로 메모이제이션 필요
- 얕은 비교(shallow comparison)만 수행

### 2. useCallback (Rule 5.5)

함수를 메모이제이션하여 의존성 배열이 변경되지 않으면 같은 함수 참조를 유지

**사용 시기**:
- React.memo를 사용하는 자식 컴포넌트에 함수를 전달할 때
- useEffect의 의존성 배열에 함수를 넣을 때
- 무거운 계산을 수행하는 함수일 때

## 측정 도구

### react-scan (권장)

정확한 렌더링 추적 도구

```bash
npm install react-scan
```

### React DevTools Profiler

브라우저 확장 프로그램으로 렌더링 성능 측정

**주의**: 상위 컴포넌트 렌더링을 잘못 표시하는 경우가 있음

## 참고 자료

- [React 공식 문서 - memo](https://react.dev/reference/react/memo)
- [React 공식 문서 - useCallback](https://react.dev/reference/react/useCallback)
- [Vercel React Best Practices](https://vercel.com/docs/frameworks/react)

## 변경 이력

- **2026-02-03**: 초기 최적화 완료
  - React.memo 적용
  - useCallback 메모이제이션
  - 29.8% 성능 향상 달성