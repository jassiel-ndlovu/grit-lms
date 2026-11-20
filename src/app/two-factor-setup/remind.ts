"use server";

import { cookies } from "next/headers";

import { TWO_FACTOR_LATER_COOKIE } from "./cookie";

/** "Remind me tomorrow": the dashboard stops sending this person to setup for a day. */
export async function remindTwoFactorLater(): Promise<void> {
  (await cookies()).set(TWO_FACTOR_LATER_COOKIE, "1", { maxAge: 24 * 60 * 60, httpOnly: true, sameSite: "lax", path: "/" });
}
