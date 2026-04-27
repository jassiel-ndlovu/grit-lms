/**
 * Activity log schemas — append-only audit trail of user actions.
 */

import { z } from "zod";

import { CuidSchema, DateSchema } from "../shared/primitives";
import { ActivityTypeSchema } from "../shared/enums";

export const ActivityLogSchema = z.object({
  id: CuidSchema,
  userId: CuidSchema,
  action: ActivityTypeSchema,
  targetId: CuidSchema.nullable(),
  meta: z.unknown().nullable(),
  createdAt: DateSchema,
});
export type ActivityLog = z.infer<typeof ActivityLogSchema>;

export const CreateActivityLogSchema = ActivityLogSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateActivityLogInput = z.infer<typeof CreateActivityLogSchema>;
