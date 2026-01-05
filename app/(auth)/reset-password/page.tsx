/**
 * Reset password page for setting a new password.
 * Validates token from email link and updates password.
 */

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/lib/auth-actions";

/**
 * Form component for entering and confirming new password.
 * Uses URL token parameter for validation.
 */
function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword(token, password);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <section className="bg-background">
        <div className="flex min-h-screen flex-col items-center justify-between gap-20 py-16 lg:flex-row lg:py-0">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-8">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-2xl text-white">
                ✓
              </div>
              <div className="space-y-2 text-center">
                <h1 className="text-foreground text-3xl font-medium tracking-tighter md:text-4xl">
                  Password reset successful
                </h1>
                <p
                  data-testid="reset-password-success-message"
                  className="text-muted-foreground text-sm"
                >
                  Your password has been reset. You can now sign in with your
                  new password.
                </p>
              </div>
            </div>

            <Button
              asChild
              className="w-full max-w-lg"
              data-testid="reset-password-sign-in-link"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
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
                Set new password
              </h1>
              <p className="text-muted-foreground text-sm">
                Choose a strong password for your account
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="w-full max-w-lg space-y-4">
            {error && (
              <div
                data-testid="reset-password-error-message"
                className="bg-destructive/10 text-destructive rounded-md px-4 py-3 text-center text-sm"
              >
                {error}
              </div>
            )}

            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              data-testid="reset-password-password-input"
            />

            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              data-testid="reset-password-confirm-password-input"
            />

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="reset-password-submit-button"
            >
              {loading ? "Resetting..." : "Reset password"}
            </Button>
          </form>
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

/**
 * Wraps reset password form with Suspense for client-side URL params.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <section className="bg-background">
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </section>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
