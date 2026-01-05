/**
 * Forgot password page for initiating password reset.
 * Sends reset email with secure token link.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/lib/auth-actions";

/**
 * Renders forgot password form with email input.
 * Shows success message after submission to prevent email enumeration.
 */
export default function ForgotPasswordPage() {
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
    <section className="bg-background">
      <div className="flex min-h-screen flex-col items-center justify-between gap-20 py-16 lg:flex-row lg:py-0">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-8">
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/logo.png"
              alt="Canoncore"
              width={80}
              height={80}
              priority
            />
            <div className="space-y-2 text-center">
              <h1 className="text-foreground text-3xl font-medium tracking-tighter md:text-4xl">
                Reset your password
              </h1>
              <p className="text-muted-foreground text-sm">
                Enter your email address and we&apos;ll send you a link to reset
                your password.
              </p>
            </div>
          </div>

          {message ? (
            <div className="w-full max-w-lg space-y-4">
              <div
                data-testid="forgot-password-success-message"
                className="rounded-md bg-green-500/10 px-4 py-3 text-center text-sm text-green-600"
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
            <form onSubmit={onSubmit} className="w-full max-w-lg space-y-4">
              {error && (
                <div
                  data-testid="forgot-password-error-message"
                  className="bg-destructive/10 text-destructive rounded-md px-4 py-3 text-center text-sm"
                >
                  {error}
                </div>
              )}

              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="forgot-password-email-input"
              />

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
        <div className="bg-muted relative hidden h-screen w-[40%] overflow-hidden lg:block">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="size-full object-cover"
            src="/auth-bg.mp4"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        </div>
      </div>
    </section>
  );
}
