"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { verifyAdmin } from "@/lib/api/admin";
import { ShieldBan, Megaphone } from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard/ban", label: "유저 밴 관리", icon: ShieldBan },
  {
    href: "/admin/dashboard/notifications",
    label: "공지사항 관리",
    icon: Megaphone,
  },
] as const;

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    verifyAdmin()
      .then(() => setIsVerified(true))
      .catch(() => router.replace("/admin"));
  }, [router]);

  if (!isVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-retro-bg-primary">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-retro-border-dark border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-retro-bg-primary">
      <nav className="w-60 border-r-3 border-retro-border-darker bg-retro-bg-secondary p-4">
        <h1 className="mb-6 text-lg font-bold text-retro-text-primary">
          관리자 대시보드
        </h1>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 rounded px-3 py-2 font-bold transition-colors ${
                    isActive
                      ? "bg-retro-button-bg text-retro-button-text"
                      : "text-retro-text-primary hover:bg-retro-hover-bg"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
