import { z } from 'zod';

export const handleSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores only');

export const userSchema = z.object({
  id: z.string().uuid(),
  handle: handleSchema,
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

/** The caller's own record, which may include fields other users never see. */
export const meSchema = userSchema.extend({
  auth0Sub: z.string(),
  email: z.string().email().nullable(),
});
export type Me = z.infer<typeof meSchema>;

export const updateProfileSchema = z.object({
  handle: handleSchema.optional(),
  displayName: z.string().min(1).max(60).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
