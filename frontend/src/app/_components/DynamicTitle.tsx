"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function DynamicTitle() {
  const { t, i18n } = useTranslation("ui");

  useEffect(() => {
    // i18n이 초기화되면 언어에 맞는 타이틀 설정
    const title = t(($) => $.metadata.title);
    document.title = title;
  }, [i18n.language, t]);

  return null; // UI 렌더링 없음
}
