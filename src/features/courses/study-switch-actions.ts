"use server";

/** Switching the study assistant on or off for one student (study-switch.ts). */

import { z } from "zod";

import { writableViewerActionClient } from "@/lib/safe-action";
import type { Viewer } from "@/lib/viewer";

import { setStudentSwitch } from "./study-switch";

const id = z.string().min(1).max(64);

export const setStudentSwitchAction = writableViewerActionClient
  .schema(z.object({ courseId: id, studentUserId: id, on: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => setStudentSwitch((ctx as { viewer: Viewer }).viewer, parsedInput));
