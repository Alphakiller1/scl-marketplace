/**
 * Brevo credential candidates, newest rotation first.
 *
 * `BREVO_EMAIL_SEND` is the write-only production rotation. Keep the standard
 * name as a fallback while the old Vercel variable is retired. A caller may
 * advance only after Brevo definitively rejects a key; network failures have an
 * unknown send outcome and must never trigger a second attempt.
 */
export function brevoApiKeys(): string[] {
  return [process.env.BREVO_EMAIL_SEND, process.env.BREVO_API_KEY]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);
}
