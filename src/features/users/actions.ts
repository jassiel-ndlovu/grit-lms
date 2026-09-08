/**
 * User provisioning actions.
 *
 * These replace the ad-hoc /api/seed-users route with typed, role-gated
 * Server Actions the tutor invokes from /dashboard/manage-users.
 *
 *   - createStudentUser  — creates User(role=STUDENT) + linked Student row
 *   - resetUserPassword  — overwrites a user's hashed password
 *
 * Both are gated on tutor session. Emails are lower-cased before storage
 * to keep sign-in matching case-insensitive.
 */

"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { tutorActionClient } from "@/lib/safe-action";

import {
  CreateStudentUserSchema,
  ResetUserPasswordSchema,
} from "./schemas";

const BCRYPT_ROUNDS = 10;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Create a User(role=STUDENT) row + its Student profile in one transaction.
 * If either row already exists for that email, the whole thing rolls back
 * and we return a friendly error.
 */
export const createStudentUser = tutorActionClient
  .schema(CreateStudentUserSchema)
  .action(async ({ parsedInput }) => {
    const email = normalizeEmail(parsedInput.email);
    const hashed = await bcrypt.hash(parsedInput.password, BCRYPT_ROUNDS);

    // Pre-flight uniqueness check so we can return a nice error rather than
    // relying on Prisma's P2002.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error(`A user with email ${email} already exists.`);
    }
    const existingStudent = await prisma.student.findUnique({
      where: { email },
    });
    if (existingStudent) {
      throw new Error(`A student profile with email ${email} already exists.`);
    }

    const [user, student] = await prisma.$transaction([
      prisma.user.create({
        data: {
          name: parsedInput.fullName.trim(),
          email,
          password: hashed,
          role: "STUDENT",
        },
        select: { id: true, name: true, email: true },
      }),
      prisma.student.create({
        data: {
          fullName: parsedInput.fullName.trim(),
          email,
          imageUrl: parsedInput.imageUrl ?? null,
        },
        select: { id: true, fullName: true, email: true },
      }),
    ]);

    revalidatePath("/dashboard/manage-users");

    return { user, student };
  });

/**
 * Reset a user's password. Tutor-only; the tutor is trusted to have
 * confirmed the user's identity (e.g. by phone/email out-of-band).
 */
export const resetUserPassword = tutorActionClient
  .schema(ResetUserPasswordSchema)
  .action(async ({ parsedInput }) => {
    const hashed = await bcrypt.hash(parsedInput.newPassword, BCRYPT_ROUNDS);

    const user = await prisma.user.update({
      where: { id: parsedInput.userId },
      data: { password: hashed },
      select: { id: true, name: true, email: true },
    });

    revalidatePath("/dashboard/manage-users");

    return { user };
  });
