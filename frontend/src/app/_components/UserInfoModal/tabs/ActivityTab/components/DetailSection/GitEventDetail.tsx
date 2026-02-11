"use client";

import { GIT_EVENT_TYPES } from "@/lib/api";
import { useGitEventHistories } from "@/lib/api/hooks";
import { useTranslation } from "react-i18next";
import { Loading } from "@/_components/ui/loading";
import { formatSelectedDate } from "@/utils/timeFormat";

type GitEventType = (typeof GIT_EVENT_TYPES)[keyof typeof GIT_EVENT_TYPES];

interface GitEventDetailProps {
  selectedCard: GitEventType;
  selectedDate: Date;
  playerId: number;
}

const EVENT_TYPE_LABEL_KEY = {
  [GIT_EVENT_TYPES.COMMITTED]: "committed",
  [GIT_EVENT_TYPES.ISSUE_OPEN]: "issueOpen",
  [GIT_EVENT_TYPES.PR_OPEN]: "prOpen",
  [GIT_EVENT_TYPES.PR_REVIEWED]: "prReviewed",
} as const;

const EVENT_CONTENT_HEADER_KEY = {
  [GIT_EVENT_TYPES.COMMITTED]: "committed",
  [GIT_EVENT_TYPES.ISSUE_OPEN]: "issueOpen",
  [GIT_EVENT_TYPES.PR_OPEN]: "prOpen",
  [GIT_EVENT_TYPES.PR_REVIEWED]: "prReviewed",
} as const;

export default function GitEventDetail({
  selectedCard,
  selectedDate,
  playerId,
}: GitEventDetailProps) {
  const { t } = useTranslation("ui");
  const { gitEvents, isLoading } = useGitEventHistories(playerId, selectedDate);

  const filteredEvents = gitEvents
    .filter((event) => event.type === selectedCard)
    .sort(
      (a, b) =>
        new Date(b.activityAt || b.createdAt).getTime() -
        new Date(a.activityAt || a.createdAt).getTime(),
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

  const labelKey = EVENT_TYPE_LABEL_KEY[selectedCard];
  const eventLabel = t(
    ($) => $.userInfoModal.activity.gitEvent.label[labelKey],
  );

  if (isLoading) {
    return (
      <div className="rounded-none border-2 border-amber-800/20 bg-amber-50 p-3">
        <div className="flex h-32 items-center justify-center">
          <Loading
            size="sm"
            text={t(($) => $.userInfoModal.activity.gitEvent.loading)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-none border-2 border-amber-800/20 bg-amber-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">
          {t(($) => $.userInfoModal.activity.gitEvent.listTitle, {
            type: eventLabel,
          })}
        </p>
        <p className="text-xs text-amber-700">
          {formatSelectedDate(selectedDate)}
        </p>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="py-4 text-center text-xs text-amber-700">
          {t(($) => $.userInfoModal.activity.gitEvent.empty, {
            type: eventLabel,
          })}
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2 border-b border-amber-300 px-2 pb-1 text-xs font-semibold text-amber-800">
            <span className="flex-1">
              {t(
                ($) =>
                  $.userInfoModal.activity.gitEvent.contentHeader[
                    EVENT_CONTENT_HEADER_KEY[selectedCard]
                  ],
              )}
            </span>
            <span className="w-36 text-center">
              {t(($) => $.userInfoModal.activity.gitEvent.time)}
            </span>
            <span className="w-16 text-center">
              {t(($) => $.userInfoModal.activity.gitEvent.point)}
            </span>
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
                  {formatTime(event.activityAt || event.createdAt)}
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
