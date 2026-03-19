"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import HeroSection from "./_components/HeroSection";
import EvolutionSection from "./_components/EvolutionSection";
import FeaturesSection from "./_components/FeaturesSection";
import DemoSection from "./_components/DemoSection";
import BannedModal from "./_components/BannedModal";
import { Analytics } from "@/lib/analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const isBanned = searchParams.get("banned") === "true";
  const reason = searchParams.get("reason");
  const [dismissed, setDismissed] = useState(false);
  const banInfo = !dismissed && isBanned ? { reason } : null;

  const handleGitHubLogin = () => {
    Analytics.loginClick();
    window.location.href = `${API_URL}/auth/github`;
  };

  return (
    <div className="bg-background text-foreground selection:bg-retro-border-dark flex min-h-screen flex-col font-sans selection:text-white dark:bg-slate-950 dark:text-slate-100">
      <HeroSection onLogin={handleGitHubLogin} />
      <FeaturesSection />
      <EvolutionSection />
      <DemoSection />
      {banInfo && (
        <BannedModal reason={banInfo.reason} onClose={() => setDismissed(true)} />
      )}
    </div>
  );
}
