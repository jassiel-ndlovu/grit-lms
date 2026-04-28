/**
 * Reusable Zod primitives composed into feature schemas.
 * Keep these tight — only generic, cross-feature building blocks belong here.
 */

import { z } from "zod";

/** Prisma cuid() identifier — opaque string, but we validate it's non-empty. */
export const CuidSchema = z.string().min(1, "Required");

/** ISO date string accepted from forms; coerced to Date. */
export const DateSchema = z.coerce.date();

/** Optional URL field that allows empty string (treated as null). */
export const OptionalUrlSchema = z
  .string()
  .url("Must be a valid URL")
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v))
  .nullable();

/** Required URL. */
export const UrlSchema = z.string().url("Must be a valid URL");

/** Non-empty trimmed string. */
export const NonEmptyString = z
  .string()
  .trim()
  .min(1, "Required");

/** Email — trimmed and lowercased. */
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address");
