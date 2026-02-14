/**
 * Sign-in form client component.
 * Handles email/password authentication with NextAuth credentials provider.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
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

          <div className="mb-8 flex flex-col space-y-1">
            <h1 className="text-2xl font-bold tracking-wide">Welcome back</h1>
            <p className="text-muted-foreground text-base">
              Sign in to your CanonCore account.
            </p>
          </div>

          <div
            id="sign-in-error"
            data-testid="sign-in-error-message"
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
                name="email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-invalid={!!error}
                aria-describedby={error ? "sign-in-error" : undefined}
                data-testid="sign-in-email-input"
              />
            </div>

            <div className="space-y-2">
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-invalid={!!error}
                aria-describedby={error ? "sign-in-error" : undefined}
                data-testid="sign-in-password-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
              data-testid="sign-in-submit-button"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-muted-foreground text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link
              href="/sign-up"
              className="text-primary font-medium hover:underline"
              data-testid="sign-in-sign-up-link"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
