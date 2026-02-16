/**
 * Forgot password form client component.
 * Sends reset email with secure token link.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import dynamic from "next/dynamic";

const FloatingPaths = dynamic(
  () =>
    import("@/components/floating-paths").then((mod) => ({
      default: mod.FloatingPaths,
    })),
  { ssr: false }
);
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/lib/auth-actions";
import { MailIcon } from "lucide-react";

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

          {message ? (
            <>
              <div className="flex justify-center">
                <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full">
                  <MailIcon className="size-7" />
                </div>
              </div>

              <div
                className="flex flex-col space-y-1 text-center"
                data-testid="forgot-password-success-message"
              >
                <h1 className="text-2xl font-bold tracking-wide">
                  Check your email
                </h1>
                <p className="text-muted-foreground text-base">{message}</p>
              </div>

              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/sign-in">Back to sign in</Link>
              </Button>
            </>
          ) : (
            <>
              <div className="mb-8 flex flex-col space-y-1">
                <h1 className="text-2xl font-bold tracking-wide">
                  Reset password
                </h1>
                <p className="text-muted-foreground text-base">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <div
                id="forgot-password-error"
                data-testid="forgot-password-error-message"
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    data-testid="forgot-password-email-input"
                    name="email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-invalid={!!error}
                    aria-describedby={
                      error ? "forgot-password-error" : undefined
                    }
                  />
                </div>

                <Button
                  type="submit"
                  data-testid="forgot-password-submit-button"
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send reset link"}
                </Button>

                <Button asChild variant="ghost" className="w-full">
                  <Link href="/sign-in">Back to sign in</Link>
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
