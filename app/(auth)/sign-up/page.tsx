/**
 * Sign-up page for new user registration.
 * Creates account and auto-signs in on success.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { signUp } from "@/lib/auth-actions";

/**
 * Renders sign-up form with email, password, and confirmation fields.
 * Validates password requirements and handles registration errors.
 */
export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

    setLoading(true);

    try {
      const result = await signUp(email, password);

      if (result.error) {
        setError(result.error);
      } else {
        // Auto sign-in after successful registration
        const signInResult = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (signInResult?.error) {
          setError(
            "Account created but sign-in failed. Please try signing in."
          );
        } else {
          router.push("/dashboard");
          router.refresh();
        }
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

          <h1 className="text-foreground mb-8 w-full text-center text-3xl font-medium tracking-tighter md:text-4xl">
            Create your free account
          </h1>

          <form onSubmit={onSubmit} className="w-full max-w-lg space-y-4">
            {error && (
              <div
                data-testid="sign-up-error-message"
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
              data-testid="sign-up-email-input"
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-muted h-14 rounded-full border-none px-5 py-4 font-medium"
              required
              minLength={8}
              data-testid="sign-up-password-input"
            />

            <Input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-muted h-14 rounded-full border-none px-5 py-4 font-medium"
              required
              data-testid="sign-up-confirm-password-input"
            />

            <Button
              type="submit"
              className="bg-foreground text-background hover:bg-foreground/90 h-14 w-full rounded-full"
              disabled={loading}
              data-testid="sign-up-submit-button"
            >
              <span className="font-medium tracking-tight">
                {loading ? "Creating account..." : "Create account"}
              </span>
            </Button>
          </form>

          <div className="flex w-full max-w-lg items-center gap-6">
            <Separator className="flex-1" />
            <span className="font-medium tracking-tight">or</span>
            <Separator className="flex-1" />
          </div>

          <p className="mb-20 w-full text-center text-sm font-medium tracking-tight">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="cursor-pointer underline"
              data-testid="sign-up-sign-in-link"
            >
              Sign in
            </Link>
          </p>
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
