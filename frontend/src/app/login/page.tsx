"use client";

import HeroSection from "./_components/HeroSection";
import EvolutionSection from "./_components/EvolutionSection";
import FeaturesSection from "./_components/FeaturesSection";
import DemoSection from "./_components/DemoSection";
import { Analytics } from "@/lib/analytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function LoginPage() {
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
    </div>
  );
}
