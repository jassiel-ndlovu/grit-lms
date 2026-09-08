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
import {
  authActionClient,
  tutorActionClient,
} from "@/lib/safe-action";

import {
  ChangeOwnPasswordSchema,
  CreateStudentUserSchema,
  ResetUserPasswordSchema,
  UpdateOwnPreferencesSchema,
  UpdateOwnProfileSchema,
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

/* ------------------------------------------------------------------------- */
/* Self-service — any signed-in user                                          */
/* ------------------------------------------------------------------------- */

/**
 * Update the signed-in user's own profile. Applies to both the User row
 * (name) and the linked Student/Tutor row (fullName + bio/imageUrl per
 * role). Bio is tutor-only; imageUrl maps to `imageUrl` for students and
 * `profileImageUrl` for tutors.
 */
export const updateOwnProfile = authActionClient
  .schema(UpdateOwnProfileSchema)
  .action(async ({ parsedInput, ctx }) => {
    const email = ctx.session.user.email.toLowerCase();
    const fullName = parsedInput.fullName.trim();

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { email },
        data: { name: fullName },
      });

      if (ctx.session.user.role === "STUDENT") {
        await tx.student.update({
          where: { email },
          data: {
            fullName,
            ...(parsedInput.imageUrl !== undefined
              ? { imageUrl: parsedInput.imageUrl }
              : {}),
          },
        });
      } else if (ctx.session.user.role === "TUTOR") {
        await tx.tutor.update({
          where: { email },
          data: {
            fullName,
            ...(parsedInput.bio !== undefined ? { bio: parsedInput.bio } : {}),
            ...(parsedInput.imageUrl !== undefined
              ? { profileImageUrl: parsedInput.imageUrl }
              : {}),
          },
        });
      }
    });

    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard");
    return { ok: true };
  });

/**
 * Change the signed-in user's password. Verifies the current password
 * before updating; the schema already enforces new === confirm.
 */
export const changeOwnPassword = authActionClient
  .schema(ChangeOwnPasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    const email = ctx.session.user.email.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true },
    });
    if (!user) throw new Error("Account not found");

    const ok = await bcrypt.compare(parsedInput.currentPassword, user.password);
    if (!ok) throw new Error("Current password is incorrect");

    const hashed = await bcrypt.hash(parsedInput.newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    return { ok: true };
  });

/**
 * Upsert the signed-in user's preferences. Preferences default to Prisma
 * defaults on create; on update only supplied fields are patched.
 */
export const updateOwnPreferences = authActionClient
  .schema(UpdateOwnPreferencesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const user = await prisma.user.findUnique({
      where: { email: ctx.session.user.email.toLowerCase() },
      select: { id: true },
    });
    if (!user) throw new Error("Account not found");

    await prisma.userPreferences.upsert({
      where: { userId: user.id },
      // On create we still write timeZone as null so the column is set;
      // Prisma applies its own defaults for the rest.
      create: { userId: user.id, timeZone: null, ...parsedInput },
      update: parsedInput,
    });

    revalidatePath("/dashboard/settings");
    return { ok: true };
  });
