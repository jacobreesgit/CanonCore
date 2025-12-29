"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/lib/auth-actions";

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
        <div className="container flex min-h-screen flex-col items-center justify-between gap-20 py-16 lg:flex-row lg:px-0 lg:py-0">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-2xl text-white">
              ✓
            </div>

            <h1 className="text-foreground mb-4 w-full text-center text-3xl font-medium tracking-tighter md:text-4xl">
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
              className="bg-foreground text-background hover:bg-foreground/90 h-14 w-full max-w-lg rounded-full"
              data-testid="reset-password-sign-in-link"
            >
              <Link href="/sign-in">
                <span className="font-medium tracking-tight">Sign in</span>
              </Link>
            </Button>
          </div>
          <div className="bg-muted hidden h-screen w-full lg:block">
            <Image
              src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-dark-7-tall.svg"
              width={800}
              height={1200}
              className="size-full object-cover"
              alt=""
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background">
      <div className="container flex min-h-screen flex-col items-center justify-between gap-20 py-16 lg:flex-row lg:px-0 lg:py-0">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6">
          <div className="bg-primary text-primary-foreground flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold">
            C
          </div>

          <h1 className="text-foreground mb-8 w-full text-center text-3xl font-medium tracking-tighter md:text-4xl">
            Set new password
          </h1>

          <form onSubmit={onSubmit} className="w-full max-w-lg space-y-4">
            {error && (
              <div
                data-testid="reset-password-error-message"
                className="bg-destructive/10 text-destructive rounded-full px-5 py-3 text-center text-sm"
              >
                {error}
              </div>
            )}

            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-muted h-14 rounded-full border-none px-5 py-4 font-medium"
              required
              minLength={8}
              data-testid="reset-password-password-input"
            />

            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-muted h-14 rounded-full border-none px-5 py-4 font-medium"
              required
              data-testid="reset-password-confirm-password-input"
            />

            <Button
              type="submit"
              className="bg-foreground text-background hover:bg-foreground/90 h-14 w-full rounded-full"
              disabled={loading}
              data-testid="reset-password-submit-button"
            >
              <span className="font-medium tracking-tight">
                {loading ? "Resetting..." : "Reset password"}
              </span>
            </Button>
          </form>
        </div>
        <div className="bg-muted hidden h-screen w-full lg:block">
          <Image
            src="https://deifkwefumgah.cloudfront.net/shadcnblocks/block/placeholder-dark-7-tall.svg"
            width={800}
            height={1200}
            className="size-full object-cover"
            alt=""
          />
        </div>
      </div>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <section className="bg-background">
          <div className="container flex min-h-screen items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </section>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
