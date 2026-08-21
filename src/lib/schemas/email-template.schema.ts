import { z } from "zod";

import {
  EMAIL_TEMPLATE_SLUGS,
  bodyPlacesButton,
  unknownVariables,
  type EmailTemplateSlug,
} from "@/lib/email-templates";

export const emailTemplateSchema = z
  .object({
    slug: z.enum(
      EMAIL_TEMPLATE_SLUGS as unknown as [
        EmailTemplateSlug,
        ...EmailTemplateSlug[],
      ],
    ),
    subject: z.string().trim().min(1, "Subject is required.").max(200),
    body: z.string().trim().min(1, "Body is required.").max(20000),
    actionLabel: z.string().trim().min(1, "Button label is required.").max(120),
    // The only optional field: not every email needs small print.
    footnote: z.string().trim().max(2000).default(""),
  })
  .superRefine((value, context) => {
    // The href is supplied by the sender, so the button is the only thing
    // carrying the verify/reset link. A body without it is a dead email.
    if (!bodyPlacesButton(value.body)) {
      context.addIssue({
        code: "custom",
        path: ["body"],
        message:
          "Add {{button}} on its own line where the button should appear — it carries the link.",
      });
    }

    const unknown = unknownVariables(value.slug, value.body);
    if (unknown.length) {
      context.addIssue({
        code: "custom",
        path: ["body"],
        message: `This email has no value for ${unknown.join(", ")}. It would send literally.`,
      });
    }
  });

export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;
