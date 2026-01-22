/**
 * Sign-in form client component.
 * Handles email/password authentication with NextAuth credentials provider.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

/**
 * Renders sign-in form with email/password fields and error handling.
 * Redirects to My Items on successful authentication.
 */
export function SignInForm() {
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
        // Get session to retrieve username for profile redirect
        const session = await getSession();
        const username = session?.user?.username;
        // Redirect to user's profile if they have a username, otherwise homepage
        router.push(username ? `/u/${username}` : "/");
        router.refresh();
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

          <form
            onSubmit={onSubmit}
            className="border-muted bg-background flex w-full max-w-sm min-w-sm flex-col items-center gap-y-4 rounded-md border px-6 py-8 shadow-md"
          >
            <h1 className="text-xl font-semibold text-balance">Welcome back</h1>

            {error && (
              <div
                data-testid="sign-in-error-message"
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
                data-testid="sign-in-email-input"
              />
            </div>

            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-muted-foreground text-xs hover:underline"
                  data-testid="sign-in-forgot-password-link"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                placeholder="Password"
                className="text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="sign-in-password-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="sign-in-submit-button"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="text-muted-foreground flex justify-center gap-1 text-sm">
            <p>Don&apos;t have an account?</p>
            <Link
              href="/sign-up"
              className="text-primary font-medium hover:underline"
              data-testid="sign-in-sign-up-link"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
