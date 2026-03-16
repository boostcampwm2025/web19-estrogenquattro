"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyAdmin } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import Toast from "@/app/_components/Toast";

export default function AdminEntryPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const handleAdminAccess = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      await verifyAdmin();
      router.push("/admin/dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setToast({ message: "권한이 없습니다.", variant: "error" });
      } else if (error instanceof ApiError && error.status === 401) {
        // fetchApi가 /login으로 리다이렉트 처리
        return;
      } else {
        setToast({ message: "서버에 연결할 수 없습니다.", variant: "error" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-retro-bg-primary flex min-h-screen items-center justify-center">
      <button
        onClick={handleAdminAccess}
        disabled={isLoading}
        className="border-retro-border-darker bg-retro-button-bg text-retro-button-text shadow-retro-md hover:bg-retro-button-hover cursor-pointer border-3 px-8 py-4 text-lg font-bold transition-all active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? "확인 중..." : "어드민 페이지 접속"}
      </button>

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
