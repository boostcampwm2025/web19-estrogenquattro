export const GIT_EVENT_TYPES = {
  COMMITTED: "COMMITTED",
  ISSUE_OPEN: "ISSUE_OPEN",
  PR_OPEN: "PR_OPEN",
  PR_REVIEWED: "PR_REVIEWED",
} as const;

// 백엔드 PointType enum과 일치하는 전체 포인트 타입
export const POINT_TYPES = {
  ALL: "ALL",
  FOCUSED: "FOCUSED",
  TASK_COMPLETED: "TASK_COMPLETED",
  ISSUE_OPEN: "ISSUE_OPEN",
  COMMITTED: "COMMITTED",
  PR_OPEN: "PR_OPEN",
  PR_MERGED: "PR_MERGED",
  PR_REVIEWED: "PR_REVIEWED",
} as const;

export type PointType = (typeof POINT_TYPES)[keyof typeof POINT_TYPES];

// 포인트 타입별 한글 라벨 (탭 버튼용)
export const POINT_TYPE_LABELS: Record<PointType, string> = {
  [POINT_TYPES.ALL]: "포인트",
  [POINT_TYPES.ISSUE_OPEN]: "Issue 생성",
  [POINT_TYPES.PR_OPEN]: "PR 생성",
  [POINT_TYPES.PR_MERGED]: "PR 병합",
  [POINT_TYPES.PR_REVIEWED]: "PR 리뷰",
  [POINT_TYPES.COMMITTED]: "커밋",
  [POINT_TYPES.TASK_COMPLETED]: "Task 완료",
  [POINT_TYPES.FOCUSED]: "집중 시간",
};

// 포인트 타입별 뱃지 이름 (상단 제목용)
export const POINT_TYPE_BADGE_NAMES: Record<PointType, string> = {
  [POINT_TYPES.ALL]: "포인트 수집가",
  [POINT_TYPES.ISSUE_OPEN]: "이슈 헌터",
  [POINT_TYPES.PR_OPEN]: "PR 개척자",
  [POINT_TYPES.PR_MERGED]: "PR 수확자",
  [POINT_TYPES.PR_REVIEWED]: "PR 수호자",
  [POINT_TYPES.COMMITTED]: "정원사",
  [POINT_TYPES.TASK_COMPLETED]: "워커홀릭",
  [POINT_TYPES.FOCUSED]: "마라토너",
};
