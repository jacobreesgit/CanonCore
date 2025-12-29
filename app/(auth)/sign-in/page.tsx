"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

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
      <div className="container flex min-h-screen flex-col items-center justify-between gap-20 py-16 lg:flex-row lg:px-0 lg:py-0">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6">
          <div className="bg-primary text-primary-foreground flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold">
            C
          </div>

          <h1 className="text-foreground mb-8 w-full text-center text-3xl font-medium tracking-tighter md:text-4xl">
            Welcome back
          </h1>

          <form onSubmit={onSubmit} className="w-full max-w-lg space-y-4">
            {error && (
              <div
                data-testid="sign-in-error-message"
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
              data-testid="sign-in-email-input"
            />

            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-muted h-14 rounded-full border-none px-5 py-4 font-medium"
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
              className="bg-foreground text-background hover:bg-foreground/90 h-14 w-full rounded-full"
              disabled={loading}
              data-testid="sign-in-submit-button"
            >
              <span className="font-medium tracking-tight">
                {loading ? "Signing in..." : "Sign in"}
              </span>
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
