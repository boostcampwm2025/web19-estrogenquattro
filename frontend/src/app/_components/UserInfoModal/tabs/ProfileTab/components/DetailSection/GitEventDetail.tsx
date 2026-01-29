"use client";

import { GIT_EVENT_TYPES } from "@/lib/api";
import { useGitEventHistories } from "@/lib/api/hooks";
import { StatCardType } from "../../constants/constants";
import { Loading } from "@/_components/ui/loading";
import { formatSelectedDate } from "@/utils/timeFormat";

interface GitEventDetailProps {
  selectedCard: StatCardType;
  selectedDate: Date;
  playerId: number;
}

const GIT_EVENT_TYPE_MAP: Record<
  string,
  (typeof GIT_EVENT_TYPES)[keyof typeof GIT_EVENT_TYPES]
> = {
  [GIT_EVENT_TYPES.COMMITTED]: GIT_EVENT_TYPES.COMMITTED,
  [GIT_EVENT_TYPES.ISSUE_OPEN]: GIT_EVENT_TYPES.ISSUE_OPEN,
  [GIT_EVENT_TYPES.PR_OPEN]: GIT_EVENT_TYPES.PR_OPEN,
  [GIT_EVENT_TYPES.PR_REVIEWED]: GIT_EVENT_TYPES.PR_REVIEWED,
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  [GIT_EVENT_TYPES.COMMITTED]: "커밋",
  [GIT_EVENT_TYPES.ISSUE_OPEN]: "이슈",
  [GIT_EVENT_TYPES.PR_OPEN]: "PR 생성",
  [GIT_EVENT_TYPES.PR_REVIEWED]: "PR 리뷰",
};

const EVENT_CONTENT_HEADER: Record<string, string> = {
  [GIT_EVENT_TYPES.COMMITTED]: "레포지토리 / 커밋 메시지",
  [GIT_EVENT_TYPES.ISSUE_OPEN]: "레포지토리 / 이슈 제목",
  [GIT_EVENT_TYPES.PR_OPEN]: "레포지토리 / PR 제목",
  [GIT_EVENT_TYPES.PR_REVIEWED]: "레포지토리 / PR 제목",
};

export default function GitEventDetail({
  selectedCard,
  selectedDate,
  playerId,
}: GitEventDetailProps) {
  const { gitEvents, isLoading } = useGitEventHistories(playerId, selectedDate);

  const filteredEvents = gitEvents
    .filter((event) => event.type === GIT_EVENT_TYPE_MAP[selectedCard])
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  if (isLoading) {
    return (
      <div className="rounded-none border-2 border-amber-800/20 bg-amber-50 p-3">
        <div className="flex h-32 items-center justify-center">
          <Loading size="sm" text="로딩 중..." />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-none border-2 border-amber-800/20 bg-amber-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">
          {EVENT_TYPE_LABEL[selectedCard]} 목록
        </p>
        <p className="text-xs text-amber-700">
          {formatSelectedDate(selectedDate)}
        </p>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="py-4 text-center text-xs text-amber-700">
          이 날짜에 {EVENT_TYPE_LABEL[selectedCard]} 기록이 없습니다.
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2 border-b border-amber-300 px-2 pb-1 text-xs font-semibold text-amber-800">
            <span className="flex-1">{EVENT_CONTENT_HEADER[selectedCard]}</span>
            <span className="w-36 text-center">시간</span>
            <span className="w-16 text-center">포인트</span>
          </div>
          <div className="space-y-2">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-2 rounded-none border border-amber-200 bg-amber-100/50 p-2 transition-colors hover:border-amber-400"
              >
                <div className="flex flex-1 flex-col gap-1">
                  {event.repository && (
                    <span className="text-xs font-semibold text-amber-900">
                      {event.repository}
                    </span>
                  )}
                  {event.description && (
                    <span className="text-xs text-amber-700">
                      {event.description}
                    </span>
                  )}
                </div>
                <span className="w-36 text-center text-xs text-amber-600">
                  {formatTime(event.createdAt)}
                </span>
                <span className="w-16 text-center text-xs font-bold text-amber-700">
                  +{event.amount}P
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}