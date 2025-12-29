"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/lib/auth-actions";

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
      <div className="container flex min-h-screen flex-col items-center justify-between gap-20 py-16 lg:flex-row lg:px-0 lg:py-0">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6">
          <div className="bg-primary text-primary-foreground flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold">
            C
          </div>

          <h1 className="text-foreground mb-4 w-full text-center text-3xl font-medium tracking-tighter md:text-4xl">
            Reset your password
          </h1>

          <p className="text-muted-foreground mb-4 text-center text-sm">
            Enter your email address and we&apos;ll send you a link to reset
            your password.
          </p>

          {message ? (
            <div className="w-full max-w-lg space-y-4">
              <div
                data-testid="forgot-password-success-message"
                className="rounded-full bg-green-500/10 px-5 py-4 text-center text-sm text-green-600"
              >
                {message}
              </div>
              <Button
                asChild
                variant="outline"
                className="h-14 w-full rounded-full"
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
                  className="bg-destructive/10 text-destructive rounded-full px-5 py-3 text-center text-sm"
                >
                  {error}
                </div>
              )}

              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-muted h-14 rounded-full border-none px-5 py-4 font-medium"
                required
                data-testid="forgot-password-email-input"
              />

              <Button
                type="submit"
                className="bg-foreground text-background hover:bg-foreground/90 h-14 w-full rounded-full"
                disabled={loading}
                data-testid="forgot-password-submit-button"
              >
                <span className="font-medium tracking-tight">
                  {loading ? "Sending..." : "Send reset link"}
                </span>
              </Button>

              <Button
                asChild
                variant="ghost"
                className="h-14 w-full rounded-full"
                data-testid="forgot-password-back-to-sign-in-link"
              >
                <Link href="/sign-in">Back to sign in</Link>
              </Button>
            </form>
          )}
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
