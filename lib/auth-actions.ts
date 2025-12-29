"use server";

import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export async function signUp(email: string, password: string) {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: "An account with this email already exists" };
    }

    const passwordHash = await hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Sign up error:", error);
    throw error;
  }
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return { success: true };
  }

  // Delete any existing password reset tokens for this user
  await prisma.passwordReset.deleteMany({
    where: { userId: user.id },
  });

  // Create new reset token (expires in 1 hour)
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordReset.create({
    data: {
      token,
      userId: user.id,
      expires,
    },
  });

  await sendPasswordResetEmail(email, token);

  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  const passwordReset = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!passwordReset) {
    return { error: "Invalid or expired reset link" };
  }

  if (passwordReset.expires < new Date()) {
    // Clean up expired token
    await prisma.passwordReset.delete({
      where: { id: passwordReset.id },
    });
    return { error: "Reset link has expired" };
  }

  const passwordHash = await hash(newPassword, 10);

  await prisma.user.update({
    where: { id: passwordReset.userId },
    data: { passwordHash },
  });

  // Delete the used token
  await prisma.passwordReset.delete({
    where: { id: passwordReset.id },
  });

  return { success: true };
}
