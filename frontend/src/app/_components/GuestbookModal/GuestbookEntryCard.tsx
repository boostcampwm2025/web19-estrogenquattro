import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "@/utils/timeFormat";
import type { GuestbookEntry } from "./types";

interface GuestbookEntryCardProps {
  entry: GuestbookEntry;
  isMine: boolean;
  onDelete: (entryId: number) => void;
}

export default function GuestbookEntryCard({
  entry,
  isMine,
  onDelete,
}: GuestbookEntryCardProps) {
  const { t } = useTranslation("ui");

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <img
          src={entry.avatarUrl}
          alt={entry.authorName}
          className="h-8 w-8 shrink-0 rounded-sm border-2 border-amber-900"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <a
              href={`https://github.com/${entry.authorName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-bold text-amber-900 transition-colors hover:text-amber-700"
            >
              {entry.authorName}
            </a>
            <span className="text-xs text-amber-500">
              {formatRelativeTime(entry.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-sm wrap-break-word whitespace-pre-wrap text-amber-800">
            {entry.content}
          </p>
        </div>
      </div>
      {isMine && (
        <button
          onClick={() => onDelete(entry.id)}
          aria-label={t(($) => $.guestbook.delete)}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border-2 border-amber-900/50 bg-transparent text-amber-700 transition-all hover:bg-amber-100 hover:text-amber-900"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
