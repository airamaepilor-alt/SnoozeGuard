import { z } from "zod";

/**
 * Accepts any string `Date.parse` understands (ISO 8601 with/without Z, space separator, etc.)
 * and normalizes to full ISO-8601 UTC for Supabase.
 */
export const flexRecordedAt = z
  .string()
  .min(4)
  .transform((s, ctx) => {
    const t = Date.parse(s.trim());
    if (Number.isNaN(t)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid recorded_at" });
      return z.NEVER;
    }
    return new Date(t).toISOString();
  });

export const iotBodySchema = z.object({
  device_id: z.string().min(1).max(128),
  session_external_id: z.string().min(1).max(256).optional(),
  recorded_at: flexRecordedAt,
  drowsiness_level: z.number().min(0).max(10),
  yawn_count: z.number().int().min(0).optional(),
  head_movement_events: z.number().int().min(0).optional(),
  sudden_brake: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type IotPayload = z.infer<typeof iotBodySchema>;
