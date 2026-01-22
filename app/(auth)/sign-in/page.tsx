/**
 * Sign-in page for existing users.
 * Server component wrapper that exports metadata.
 */

import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign In - CanonCore",
  description: "Sign in to your CanonCore account.",
};

/**
 * Renders the sign-in page with metadata.
 */
export default function SignInPage() {
  return <SignInForm />;
}
