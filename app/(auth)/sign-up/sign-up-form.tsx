/**
 * Sign-up form client component.
 * Creates account and auto-signs in on success.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
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
import { signUp } from "@/lib/auth-actions";
import { useUsernameValidation } from "@/hooks/use-username-validation";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Renders sign-up form with email, username, password, and confirmation fields.
 * Validates password requirements and handles registration errors.
 */
export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const validation = useUsernameValidation(username);
  const {
    isValidating,
    isValidFormat,
    isAvailable,
    error: usernameError,
    success: usernameSuccess,
  } = validation;
  const isUsernameValid = username && isValidFormat && isAvailable === true;

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

    // Check username validity if provided
    if (username && !isUsernameValid) {
      setError(usernameError || "Please wait for username validation");
      return;
    }

    setLoading(true);

    try {
      const result = await signUp(email, password, username || undefined);

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
          // Redirect to user's profile if username was provided, otherwise homepage
          router.push(username ? `/u/${username}` : "/");
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
            <h1 className="text-2xl font-bold tracking-wide">Create account</h1>
            <p className="text-muted-foreground text-base">
              Join CanonCore and start organising.
            </p>
          </div>

          <div
            id="sign-up-error"
            data-testid="sign-up-error-message"
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
                aria-describedby={error ? "sign-up-error" : undefined}
                data-testid="sign-up-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">
                Username{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <div className="relative">
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  spellCheck={false}
                  placeholder="Choose a username"
                  className={cn(
                    "pr-10",
                    username &&
                      (isUsernameValid
                        ? "border-green-500 focus-visible:ring-green-500/20"
                        : usernameError
                          ? "border-destructive focus-visible:ring-destructive/20"
                          : "")
                  )}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  aria-invalid={!!(username && usernameError)}
                  aria-describedby={
                    username && usernameError
                      ? "username-error"
                      : username && usernameSuccess
                        ? "username-success"
                        : undefined
                  }
                  data-testid="sign-up-username-input"
                />
                {username && (
                  <div className="absolute top-1/2 right-3 -translate-y-1/2">
                    {isValidating ? (
                      <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                    ) : isUsernameValid ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : usernameError ? (
                      <X className="text-destructive h-4 w-4" />
                    ) : null}
                  </div>
                )}
              </div>
              {username && usernameError && (
                <p
                  id="username-error"
                  className="text-destructive text-xs"
                  aria-live="polite"
                >
                  {usernameError}
                </p>
              )}
              {username && usernameSuccess && (
                <p
                  id="username-success"
                  className="text-xs text-green-600"
                  aria-live="polite"
                >
                  {usernameSuccess}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="new-password"
                autoComplete="new-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                aria-invalid={!!error}
                aria-describedby={error ? "sign-up-error" : undefined}
                data-testid="sign-up-password-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirm-password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                aria-invalid={!!error}
                aria-describedby={error ? "sign-up-error" : undefined}
                data-testid="sign-up-confirm-password-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
              data-testid="sign-up-submit-button"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-primary font-medium hover:underline"
              data-testid="sign-up-sign-in-link"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
