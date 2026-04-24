import type { Metadata } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Playfair_Display } from "next/font/google";
import { PosthogProvider } from "@/components/analytics/posthog-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PitchFlare — AI-native PR",
  description:
    "AI-native PR and media intelligence for freelance consultants and boutique agencies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
        <body className="min-h-screen bg-background font-sans antialiased">
          <Suspense fallback={null}>
            <PosthogProvider>{children}</PosthogProvider>
          </Suspense>
        </body>
      </html>
    </ClerkProvider>
  );
}
