import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { PosthogProvider } from "@/components/analytics/posthog-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PitchFlare — AI-native PR, from pitch to placement",
  description:
    "PR strategy, pitching, send tracking, coverage analytics, and client-ready reports in one AI platform for freelance consultants and boutique agencies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="min-h-screen bg-background font-sans antialiased">
          <Suspense fallback={null}>
            <PosthogProvider>{children}</PosthogProvider>
          </Suspense>
        </body>
      </html>
    </ClerkProvider>
  );
}
