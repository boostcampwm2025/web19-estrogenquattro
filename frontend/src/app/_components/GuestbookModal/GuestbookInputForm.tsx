import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";

const PIXEL_BORDER = "border-3 border-amber-900";

interface GuestbookInputFormProps {
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyUp: (e: React.KeyboardEvent) => void;
  errorMessage?: string;
}

export default function GuestbookInputForm({
  value,
  maxLength,
  onChange,
  onSubmit,
  onKeyDown,
  onKeyUp,
  errorMessage,
}: GuestbookInputFormProps) {
  const { t } = useTranslation("ui");
  const hasContent = value.trim().length > 0;

  return (
    <div className={`${PIXEL_BORDER} bg-white/50 p-4`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        placeholder={t(($) => $.guestbook.placeholder)}
        className="retro-scrollbar w-full resize-none bg-transparent p-0 text-base text-amber-900 placeholder-amber-400 outline-none"
        rows={2}
        maxLength={maxLength}
        autoFocus
      />
      {errorMessage && (
        <p className="mb-1 text-xs text-red-600">{errorMessage}</p>
      )}
      <div className="flex items-end justify-between">
        <span className="text-sm text-amber-500">
          {value.length}/{maxLength}
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!hasContent}
          aria-label={t(($) => $.guestbook.submit)}
          className={`flex h-8 w-8 items-center justify-center border-2 font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,0.25)] transition-all ${
            hasContent
              ? "cursor-pointer bg-amber-200 text-amber-900 hover:bg-amber-300 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              : "cursor-not-allowed bg-gray-200 text-gray-400"
          }`}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
