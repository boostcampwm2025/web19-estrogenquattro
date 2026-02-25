import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 정적 빌드를 위해 기본값 설정 (영어)
export const metadata: Metadata = {
  title: "Commit Please",
  description: "Online Co-working Service",
  icons: {
    icon: "/jandi.ico",
  },
};

import Providers from "./_components/Providers";
import DynamicTitle from "./_components/DynamicTitle";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <DynamicTitle />
          {children}
        </Providers>
      </body>
    </html>
  );
}
