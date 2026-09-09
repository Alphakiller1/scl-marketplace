"use client";

import { parseEmailBodyBlocks } from "@/lib/email-image";

/**
 * The message as an inbox will lay it out.
 *
 * Built from `parseEmailBodyBlocks` — the same function the mailer renders with —
 * so the position an owner sees here is the position that ships. Only the
 * presentation differs: this draws React, the mailer writes inline-styled HTML.
 *
 * Deliberately light-on-white rather than themed. Email has no dark mode worth
 * relying on, every image is flattened onto white before it is stored, and a
 * preview painted in the admin's dark chrome would misrepresent both. This is a
 * picture of the delivered mail, not app furniture.
 */
export function EmailBodyPreview({
  body,
  imageUrls,
  unsubscribeNote,
}: {
  body: string;
  /** Handle → public URL for every image uploaded in this session. */
  imageUrls: Record<string, string>;
  /** Mass sends carry an unsubscribe footer; a direct message does not. */
  unsubscribeNote: boolean;
}) {
  const blocks = parseEmailBodyBlocks(body);

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <p className="text-muted-foreground bg-surface-2 border-border border-b px-3 py-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
        Preview
      </p>
      <div className="bg-white px-4 py-4 text-neutral-900">
        <div className="mx-auto max-w-[560px]">
          {blocks.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nothing to preview yet. Write the message and drop in an image.
            </p>
          ) : (
            blocks.map((block, index) => {
              if (block.kind === "text") {
                return (
                  <p
                    key={`t-${index}`}
                    className="mb-3 text-sm leading-relaxed whitespace-pre-line"
                  >
                    {block.text}
                  </p>
                );
              }

              const src = imageUrls[block.id];
              return (
                <div key={`i-${block.id}-${index}`} className="mb-4">
                  {src ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- the
                       exact Supabase URL the email carries; next/image would
                       proxy and re-encode it, so a broken upload would still
                       look fine here and fail in the inbox. */
                    <img
                      src={src}
                      alt={block.alt}
                      width={block.displayWidth}
                      className="block h-auto w-full"
                      style={{ maxWidth: `${block.displayWidth}px` }}
                    />
                  ) : (
                    <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-center text-xs text-neutral-500">
                      An image is placed here, but it was uploaded in another
                      session so it cannot be shown.
                    </p>
                  )}
                </div>
              );
            })
          )}

          {unsubscribeNote && blocks.length > 0 ? (
            <>
              <hr className="my-5 border-neutral-200" />
              <p className="text-xs text-neutral-500">
                You are receiving this because you have an SCL capper account.{" "}
                <span className="underline">
                  Unsubscribe from announcements
                </span>{" "}
                — account and security emails will still reach you.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
