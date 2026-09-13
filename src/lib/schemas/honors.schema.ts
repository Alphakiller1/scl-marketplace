import { z } from "zod";

export const honorsContentSchema = z.object({
  title: z.string().trim().min(3).max(100),
  body: z.string().trim().min(50).max(20_000),
});
export type HonorsContentInput = z.infer<typeof honorsContentSchema>;
