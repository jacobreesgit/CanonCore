/**
 * Sign-up page for new user registration.
 * Creates account and auto-signs in on success.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
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
export default function SignUpPage() {
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
          router.push("/my-items");
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
              Create your account
            </h1>

            {error && (
              <div
                data-testid="sign-up-error-message"
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
                data-testid="sign-up-email-input"
              />
            </div>

            <div className="flex w-full flex-col gap-2">
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
                    "pr-10 text-sm",
                    username &&
                      (isUsernameValid
                        ? "border-green-500 focus-visible:ring-green-500/20"
                        : usernameError
                          ? "border-destructive focus-visible:ring-destructive/20"
                          : "")
                  )}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
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
                <p className="text-destructive text-xs">{usernameError}</p>
              )}
              {username && usernameSuccess && (
                <p className="text-xs text-green-600">{usernameSuccess}</p>
              )}
            </div>

            <div className="flex w-full flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="new-password"
                autoComplete="new-password"
                placeholder="Password"
                className="text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                data-testid="sign-up-password-input"
              />
            </div>

            <div className="flex w-full flex-col gap-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirm-password"
                autoComplete="new-password"
                placeholder="Confirm password"
                className="text-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="sign-up-confirm-password-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="sign-up-submit-button"
            >
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <div className="text-muted-foreground flex justify-center gap-1 text-sm">
            <p>Already have an account?</p>
            <Link
              href="/sign-in"
              className="text-primary font-medium hover:underline"
              data-testid="sign-up-sign-in-link"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
