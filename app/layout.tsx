/**
 * Root layout for the entire application.
 * Sets up fonts, session provider, and analytics tracking.
 */

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { DeferredAnalytics } from "@/components/providers/deferred-analytics";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "CanonCore",
  description: "CanonCore - Media Library Manager",
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
        <ThemeProvider>
          <SessionProvider>{children}</SessionProvider>
          <Toaster />
        </ThemeProvider>
        <DeferredAnalytics />
      </body>
    </html>
  );
}
