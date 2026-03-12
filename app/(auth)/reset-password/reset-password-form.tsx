/**
 * Reset password form client component.
 * Validates token from email link and updates password.
 */

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { FloatingPaths } from "@/components/floating-paths";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPassword } from "@/lib/auth-actions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

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

  return (
    <main
      id="main-content"
      className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2"
    >
      {/* Left panel - decorative */}
      <div className="bg-secondary dark:bg-secondary/20 relative hidden h-full flex-col border-r p-10 lg:flex">
        <div className="to-background absolute inset-0 bg-gradient-to-b from-transparent via-transparent" />
        <Link href="/">
          <Logo />
        </Link>

        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
      </div>

      {/* Right panel - form */}
      <div className="relative flex min-h-screen flex-col justify-center p-4">
        <div
          aria-hidden
          className="absolute inset-0 isolate -z-10 opacity-60 contain-strict"
        >
          <div className="bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)] absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full" />
          <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 [translate:5%_-50%] rounded-full" />
          <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 -translate-y-87.5 rounded-full" />
        </div>

        <div className="mx-auto w-full max-w-sm space-y-4">
          <Link href="/" className="mb-4 block lg:hidden">
            <Logo />
          </Link>

          {success ? (
            <>
              <div className="flex justify-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-green-500 text-white">
                  <FontAwesomeIcon icon={faCheck} className="size-7" />
                </div>
              </div>

              <div
                className="flex flex-col space-y-1 text-center"
                data-testid="reset-password-success-message"
              >
                <h1 className="text-2xl font-bold tracking-wide">
                  Password reset successful
                </h1>
                <p className="text-muted-foreground text-base">
                  Your password has been reset. You can now sign in with your
                  new password.
                </p>
              </div>

              <Button asChild className="w-full" size="lg">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </>
          ) : (
            <>
              <div className="mb-8 flex flex-col space-y-1">
                <h1 className="text-2xl font-bold tracking-wide">
                  Set new password
                </h1>
                <p className="text-muted-foreground text-base">
                  Choose a strong password for your account.
                </p>
              </div>

              <div
                id="reset-password-error"
                data-testid="reset-password-error-message"
                className={
                  error
                    ? "bg-destructive/10 text-destructive w-full rounded-md px-4 py-3 text-center text-sm"
                    : "sr-only"
                }
                role="alert"
                aria-live="polite"
              >
                {error}
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <PasswordInput
                    id="password"
                    data-testid="reset-password-password-input"
                    name="new-password"
                    autoComplete="new-password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    aria-invalid={!!error}
                    aria-describedby={
                      error ? "reset-password-error" : undefined
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    data-testid="reset-password-confirm-password-input"
                    name="confirm-password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    aria-invalid={!!error}
                    aria-describedby={
                      error ? "reset-password-error" : undefined
                    }
                  />
                </div>

                <Button
                  type="submit"
                  data-testid="reset-password-submit-button"
                  className="w-full"
                  size="lg"
                  loading={loading}
                  loadingText="Resetting…"
                >
                  Reset password
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * Wraps reset password form with Suspense for client-side URL params.
 */
export function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <main
          id="main-content"
          className="flex min-h-screen items-center justify-center"
        >
          <div className="text-muted-foreground">Loading...</div>
        </main>
      }
    >
      <ResetPasswordFormInner />
    </Suspense>
  );
}
