/**
 * Sign-up page for new user registration.
 * Server component wrapper that exports metadata.
 */

import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Sign Up - CanonCore",
  description: "Create your CanonCore account.",
};

/**
 * Renders the sign-up page with metadata.
 */
export default function SignUpPage() {
  return <SignUpForm />;
}
