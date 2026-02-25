"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";

export default function AuthCallbackPage() {
  const { t } = useTranslation("common");
  const { fetchUser, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        window.location.replace("/");
      } else {
        window.location.replace("/login");
      }
    }
  }, [isLoading, isAuthenticated]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-600 border-t-white" />
        <p className="text-white">{t(($) => $.verifying)}</p>
      </div>
    </div>
  );
}
