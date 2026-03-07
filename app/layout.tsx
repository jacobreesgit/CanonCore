/**
 * Root layout for the entire application.
 * Sets up fonts, session provider, and analytics tracking.
 */

import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { StoreProvider } from "@/components/providers/store-provider";
import { AudioManager } from "@/components/media/audio-manager";
import { PlaybackKeyboardHandler } from "@/components/media/playback-keyboard-handler";
import { MiniPlayer } from "@/components/media/mini-player";
import { ExpandedPlayer } from "@/components/media/expanded-player";
import { DeferredAnalytics } from "@/components/providers/deferred-analytics";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "CanonCore",
  description: "CanonCore - Media Library Manager",
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.ico", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", media: "(prefers-color-scheme: light)" },
      {
        url: "/apple-touch-icon-dark.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

/**
 * Viewport configuration for safe area support on notched devices.
 * viewport-fit=cover enables env(safe-area-inset-*) CSS functions.
 */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#242424" },
  ],
};

/**
 * Wraps all pages with HTML structure, fonts, and session context.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Preconnect to TMDB image CDN for faster poster/backdrop loading */}
        <link rel="preconnect" href="https://image.tmdb.org" />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} overflow-hidden antialiased`}
      >
        {/* Skip link for keyboard/screen reader users - WCAG 2.1 Level A */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <NuqsAdapter>
          <ThemeProvider>
            <SessionProvider>
              <QueryProvider>
                <StoreProvider>
                  <AudioManager />
                  <PlaybackKeyboardHandler />
                  {children}
                  <MiniPlayer />
                  <ExpandedPlayer />
                </StoreProvider>
              </QueryProvider>
            </SessionProvider>
            <Toaster />
          </ThemeProvider>
        </NuqsAdapter>
        <DeferredAnalytics />
      </body>
    </html>
  );
}
