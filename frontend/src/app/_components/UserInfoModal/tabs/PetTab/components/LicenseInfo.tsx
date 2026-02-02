"use client";

import { FileText } from "lucide-react";

const GITHUB_LICENSE_URL =
  "https://github.com/boostcampwm2025/web19-estrogenquattro/blob/main/LICENSES.md";

export function LicenseInfo() {
  const handleClick = () => {
    window.open(GITHUB_LICENSE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      className="flex cursor-pointer items-center gap-1 text-xs text-amber-700 transition-colors hover:text-amber-900"
      aria-label="라이선스 정보 보기"
    >
      <FileText className="h-3 w-3" />
      <span>라이선스 정보</span>
    </button>
  );
}
