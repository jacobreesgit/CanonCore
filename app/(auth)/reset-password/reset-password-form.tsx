/**
 * Reset password form client component.
 * Validates token from email link and updates password.
 */

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPassword } from "@/lib/auth-actions";

/**
 * Form component for entering and confirming new password.
 * Uses URL token parameter for validation.
 */
function ResetPasswordFormInner() {
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
            {/* Success checkmark */}
            <div className="flex size-14 items-center justify-center rounded-full bg-green-500 text-white">
              <Check className="size-7" />
            </div>

            <div className="border-muted bg-background flex w-full max-w-sm min-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md">
              <h1 className="text-xl font-semibold text-balance">
                Password reset successful
              </h1>
              <p
                data-testid="reset-password-success-message"
                className="text-muted-foreground text-center text-sm"
              >
                Your password has been reset. You can now sign in with your new
                password.
              </p>

              <Button
                asChild
                className="w-full"
                data-testid="reset-password-sign-in-link"
              >
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

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

          <form
            onSubmit={onSubmit}
            className="border-muted bg-background flex w-full max-w-sm min-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md"
          >
            <h1 className="text-xl font-semibold text-balance">
              Set new password
            </h1>
            <p className="text-muted-foreground text-center text-sm">
              Choose a strong password for your account
            </p>

            {error && (
              <div
                data-testid="reset-password-error-message"
                className="bg-destructive/10 text-destructive w-full rounded-md px-4 py-3 text-center text-sm"
              >
                {error}
              </div>
            )}

            <div className="flex w-full flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                name="new-password"
                autoComplete="new-password"
                placeholder="New password"
                className="text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                data-testid="reset-password-password-input"
              />
            </div>

            <div className="flex w-full flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirm-password"
                autoComplete="new-password"
                placeholder="Confirm new password"
                className="text-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="reset-password-confirm-password-input"
              />
            </div>

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
      </div>
    </section>
  );
}

/**
 * Wraps reset password form with Suspense for client-side URL params.
 */
export function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <section className="bg-muted h-screen">
          <div className="flex h-full items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </section>
      }
    >
      <ResetPasswordFormInner />
    </Suspense>
  );
}
