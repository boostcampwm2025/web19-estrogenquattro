"use client";

import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

const GITHUB_LICENSE_URL =
  "https://github.com/boostcampwm2025/web19-estrogenquattro/blob/main/LICENSES.md";

export function LicenseInfo() {
  const { t } = useTranslation("ui");
  const handleClick = () => {
    window.open(GITHUB_LICENSE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      className="flex cursor-pointer items-center gap-1 text-xs text-amber-700 transition-colors hover:text-amber-900"
      aria-label={t(($) => $.userInfoModal.pet.license.ariaLabel)}
    >
      <FileText className="h-3 w-3" />
      <span>{t(($) => $.userInfoModal.pet.license.text)}</span>
    </button>
  );
}
