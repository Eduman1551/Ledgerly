import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppProvider } from "@/components/app-context";
import { TopBar } from "@/components/top-bar";
import { Toaster } from "@/components/ui/sonner";
import { aiModelLabel, isAiConfigured } from "@/lib/ai/client";
import { SEED_USERS } from "@/lib/seed/data";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ledgerly · on-brand content, every claim verified",
  description: "Ledgerly checks every claim in your content against approved sources, and learns from reviewer decisions to make brand guidelines clearer.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [user, cookieStore] = await Promise.all([getCurrentUser(), cookies()]);
  const aiOff = cookieStore.get("ledgerly_ai")?.value === "off";
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white">
        <AppProvider user={user} personas={SEED_USERS} aiConfigured={isAiConfigured()} aiModel={aiModelLabel()} aiOff={aiOff}>
          <TopBar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
          <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
            Ledgerly · CodeNova India 2026 · Team CookedCoders · Demo with a fictional brand (Kesar &amp; Co.). Ledgerly never publishes; humans approve.
          </footer>
          <Toaster position="bottom-right" richColors />
        </AppProvider>
      </body>
    </html>
  );
}
