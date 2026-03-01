# 방명록 무한 스크롤 라이브러리 선정

## 선택: `react-intersection-observer`

- **패키지**: https://www.npmjs.com/package/react-intersection-observer
- **버전**: 10.x
- **번들 크기**: gzip ~1.5KB

## 선정 이유

1. **경량**: gzip 기준 약 1.5KB로 번들 사이즈에 거의 영향을 주지 않음
2. **성능**: 브라우저 네이티브 Intersection Observer API를 래핑하여, scroll event listener 대비 메인 스레드 부하가 적음
3. **React 친화적**: `useInView` hook 기반으로, 기존 프로젝트의 hook 패턴과 일관성 유지
4. **안정성**: 주간 다운로드 400만+, 활발한 유지보수
5. **확장성**: mock 데이터에서 실제 API(페이지네이션/커서 기반)로 전환 시 구조 변경 최소

## 대안 비교

| 라이브러리 | 방식 | 번들 크기 | 비고 |
|---|---|---|---|
| `react-intersection-observer` | Intersection Observer | ~1.5KB | 선택 |
| `react-infinite-scroll-component` | scroll event | ~3KB | 스크롤 이벤트 기반, 성능 열위 |
| `@tanstack/react-virtual` | 가상화 | ~10KB | 수만 개 항목에 적합, 방명록 수준에는 과도 |
| 직접 구현 (IntersectionObserver) | Intersection Observer | 0KB | cleanup/threshold 관리 부담, 라이브러리 위임이 안정적 |

## 사용 방식

```tsx
import { useInView } from "react-intersection-observer";

const { ref: bottomRef, inView } = useInView({ threshold: 0 });

useEffect(() => {
  if (inView && hasMore) loadMore();
}, [inView, hasMore, loadMore]);

// JSX 내 스크롤 영역 하단에 배치
{hasMore && <div ref={bottomRef} />}
```

스크롤 영역 하단에 보이지 않는 sentinel 요소를 배치하고, 이 요소가 뷰포트에 진입하면 다음 페이지를 로드한다.
