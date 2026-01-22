/**
 * Forgot password form client component.
 * Sends reset email with secure token link.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/lib/auth-actions";

/**
 * Renders forgot password form with email input.
 * Shows success message after submission to prevent email enumeration.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const result = await forgotPassword(email);
      if (result.success) {
        setMessage(
          "If an account exists with this email, a password reset link has been sent."
        );
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-muted relative h-screen overflow-hidden">
      {/* Background Gradient */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            radial-gradient(circle 600px at 0% 200px, oklch(from var(--primary) calc(l * 0.7) calc(c * 0.6) h / 0.15), transparent),
            radial-gradient(circle 600px at 100% 200px, oklch(from var(--primary) calc(l * 0.75) calc(c * 0.65) h / 0.12), transparent)
          `,
        }}
      />
      <div
        className="relative z-10 flex h-full items-center justify-center"
        style={{
          paddingTop: "var(--safe-area-inset-top)",
          paddingRight: "var(--safe-area-inset-right)",
          paddingBottom: "var(--safe-area-inset-bottom)",
          paddingLeft: "var(--safe-area-inset-left)",
        }}
      >
        <div className="flex flex-col items-center gap-6 lg:justify-start">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/black.png" alt="CanonCore" className="h-6 dark:invert" />
            <span className="text-xl font-semibold">CanonCore</span>
          </Link>

          {message ? (
            <div className="border-muted bg-background flex w-full max-w-sm min-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md">
              <h1 className="text-xl font-semibold text-balance">
                Check your email
              </h1>

              <div
                data-testid="forgot-password-success-message"
                className="w-full rounded-md bg-green-500/10 px-4 py-3 text-center text-sm text-green-600"
              >
                {message}
              </div>

              <Button
                asChild
                variant="outline"
                className="w-full"
                data-testid="forgot-password-back-to-sign-in-link"
              >
                <Link href="/sign-in">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="border-muted bg-background flex w-full max-w-sm min-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md"
            >
              <h1 className="text-xl font-semibold text-balance">
                Reset your password
              </h1>
              <p className="text-muted-foreground text-center text-sm">
                Enter your email address and we&apos;ll send you a link to reset
                your password.
              </p>

              {error && (
                <div
                  data-testid="forgot-password-error-message"
                  className="bg-destructive/10 text-destructive w-full rounded-md px-4 py-3 text-center text-sm"
                >
                  {error}
                </div>
              )}

              <div className="flex w-full flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="Email"
                  className="text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="forgot-password-email-input"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="forgot-password-submit-button"
              >
                {loading ? "Sending..." : "Send reset link"}
              </Button>

              <Button
                asChild
                variant="ghost"
                className="w-full"
                data-testid="forgot-password-back-to-sign-in-link"
              >
                <Link href="/sign-in">Back to sign in</Link>
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
