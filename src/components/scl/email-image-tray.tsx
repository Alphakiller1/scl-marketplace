"use client";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EMAIL_IMAGE_ALT_MAX_LENGTH,
  EMAIL_IMAGE_MAX_PER_EMAIL,
} from "@/lib/email-image";

export type ComposerImage = {
  id: string;
  url: string;
  alt: string;
  width: number;
  /** Name of the file the owner picked, for identifying it in the tray. */
  fileName: string;
  /** True while this image has no token in the message body. */
  detached: boolean;
};

/**
 * The images attached to the message being composed.
 *
 * Each row is one uploaded picture: what it looks like, what blocked-image
 * readers will be told it is, and whether it is currently placed in the message
 * at all — an upload the owner then deleted the token for is still listed here so
 * it can be put back rather than re-uploaded.
 */
export function EmailImageTray({
  images,
  uploading,
  disabled,
  onPick,
  onAltChange,
  onInsert,
  onRemove,
}: {
  images: ComposerImage[];
  uploading: number;
  disabled: boolean;
  onPick: () => void;
  onAltChange: (id: string, alt: string) => void;
  onInsert: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const atLimit = images.length >= EMAIL_IMAGE_MAX_PER_EMAIL;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-10"
          disabled={disabled || atLimit || uploading > 0}
          onClick={onPick}
        >
          {uploading > 0 ? (
            <LoaderCircle
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
          {uploading > 0
            ? `Uploading ${uploading} image${uploading === 1 ? "" : "s"}…`
            : "Add image"}
        </Button>
        <p className="text-muted-foreground text-xs">
          {atLimit
            ? `That's the limit of ${EMAIL_IMAGE_MAX_PER_EMAIL} images.`
            : "Or drag one onto the message, or paste it."}
        </p>
      </div>

      {images.length > 0 ? (
        <ul className="space-y-2">
          {images.map((image) => (
            <li
              key={image.id}
              className="border-border bg-surface-2 flex flex-wrap items-start gap-3 rounded-xl border p-2.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the same
                  Supabase URL the email will use, so what the owner checks here
                  is exactly what an inbox fetches. next/image would proxy and
                  re-encode it, hiding a broken upload. */}
              <img
                src={image.url}
                alt=""
                // White ground because that is what the mail will sit on: uploads are
                // flattened onto white, so this is the picture as an inbox shows it.
                className="h-14 w-20 shrink-0 rounded-lg bg-white object-contain"
              />
              <div className="min-w-36 flex-1 space-y-1.5">
                <label
                  className="text-muted-foreground block text-[11px] font-semibold tracking-[0.08em] uppercase"
                  htmlFor={`alt-${image.id}`}
                >
                  Describe this image
                </label>
                <Input
                  id={`alt-${image.id}`}
                  value={image.alt}
                  maxLength={EMAIL_IMAGE_ALT_MAX_LENGTH}
                  disabled={disabled}
                  onChange={(event) =>
                    onAltChange(image.id, event.target.value)
                  }
                  className="min-h-10"
                />
                <p className="text-muted-foreground text-xs">
                  {image.detached ? (
                    <span className="text-neg">
                      Not placed in the message yet.
                    </span>
                  ) : (
                    `${image.width}px wide · ${image.fileName}`
                  )}
                </p>
              </div>
              <div className="flex gap-1.5">
                {image.detached ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-10"
                    disabled={disabled}
                    onClick={() => onInsert(image.id)}
                  >
                    Place
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10"
                  disabled={disabled}
                  onClick={() => onRemove(image.id)}
                  aria-label={`Remove ${image.fileName}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
