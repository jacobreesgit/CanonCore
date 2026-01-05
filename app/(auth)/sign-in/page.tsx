/**
 * Sign-in page for existing users.
 * Handles email/password authentication with NextAuth credentials provider.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/**
 * Renders sign-in form with email/password fields and error handling.
 * Redirects to dashboard on successful authentication.
 */
export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
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
                Welcome back
              </h1>
              <p className="text-muted-foreground text-sm">
                Your universe of content awaits
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="w-full max-w-lg space-y-4">
            {error && (
              <div
                data-testid="sign-in-error-message"
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
              data-testid="sign-in-email-input"
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="sign-in-password-input"
            />

            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-muted-foreground text-sm hover:underline"
                data-testid="sign-in-forgot-password-link"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="sign-in-submit-button"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="flex w-full max-w-lg items-center gap-6">
            <Separator className="flex-1" />
            <span className="font-medium tracking-tight">or</span>
            <Separator className="flex-1" />
          </div>

          <p className="mb-20 w-full text-center text-sm font-medium tracking-tight">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="cursor-pointer underline"
              data-testid="sign-in-sign-up-link"
            >
              Sign up
            </Link>
          </p>
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
