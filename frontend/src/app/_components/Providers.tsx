"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/i18n";

export default function Providers({ children }: { children: React.ReactNode }) {
  const { t, i18n, ready } = useTranslation("ui");

  // useState를 사용하여 클라이언트 사이드에서만 QueryClient가 생성되도록 보장 (Hydration mismatch 방지)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // SSG/SSR 환경에서 불필요한 즉시 refetch 방지
            staleTime: 60 * 1000,
          },
        },
      }),
  );

  // locale 변경 시 document.title 업데이트 및 클라이언트 언어 감지
  useEffect(() => {
    if (ready && i18n.isInitialized) {
      // 1. 클라이언트 사이드 언어 감지 및 적용 (Hydration 이후 수행)
      // 서버는 항상 'en'으로 렌더링되므로, 클라이언트에서 사용자 언어를 감지하여 전환
      if (i18n.language === "en") {
        const detectedLng = navigator.language.split("-")[0]; // ko-KR -> ko
        if (
          detectedLng &&
          detectedLng !== "en" &&
          ["ko", "en"].includes(detectedLng)
        ) {
          i18n.changeLanguage(detectedLng);
        }
      }

      // 2. 타이틀 업데이트
      document.title = t(($) => $.metadata.title);
    }
  }, [i18n.language, i18n.isInitialized, ready, t]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
