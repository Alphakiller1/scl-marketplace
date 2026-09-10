"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmailBodyPreview } from "@/components/scl/email-body-preview";
import {
  EmailImageTray,
  type ComposerImage,
} from "@/components/scl/email-image-tray";
import {
  importEmailImageFromUrlAction,
  uploadEmailImageAction,
} from "@/lib/actions/email-image.action";
import {
  collectEmailImageIds,
  emailImageUrlFrom,
  EMAIL_IMAGE_MAX_PER_EMAIL,
  formatEmailImageToken,
  insertEmailImageToken,
  removeEmailImageToken,
  replaceEmailImageToken,
} from "@/lib/email-image";
import {
  imageFilesFromTransfer,
  imageUrlFromPastedHtml,
  transferHasFile,
} from "@/lib/email-image-client";
import { normalizeProfileMediaFile } from "@/lib/profile-media-client";
import {
  EMAIL_IMAGE_SIZE_LIMIT_MESSAGE,
  exceedsEmailImageSizeLimit,
} from "@/lib/schemas/email-image.schema";
import { cn } from "@/lib/utils";

const ACCEPTED_IMAGES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

/**
 * A message box that takes pictures — the one image control for every email an
 * owner can write.
 *
 * Both admin email surfaces mount this: the mass email at `/admin/messages` and
 * the automated templates at `/admin/emails`. Sharing the component is what
 * makes "add an image" mean the same thing, look the same, and behave the same
 * in both places, rather than being a feature of one screen.
 *
 * Images already in the text resolve from `imageBaseUrl`, so reopening a saved
 * template weeks later still shows its pictures — the marker carries everything
 * needed to rebuild the URL.
 */
export function EmailBodyField({
  id,
  value,
  onChange,
  imageBaseUrl,
  rows = 10,
  maxLength = 10_000,
  disabled = false,
  className,
  help,
  showPreview = true,
  unsubscribeNote = false,
  onBusyChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  /** Public base for the email image bucket, or null when unconfigured. */
  imageBaseUrl: string | null;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  help?: React.ReactNode;
  showPreview?: boolean;
  unsubscribeNote?: boolean;
  onBusyChange?: (uploading: number) => void;
}) {
  const [uploads, setUploads] = useState<Omit<ComposerImage, "detached">[]>([]);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * Mirrors `value` so an insert can read the latest text synchronously. Uploads
   * are awaited one at a time, but reading a prop through a closure still hands
   * back the value from the render the loop started in, which would drop the
   * previous image's marker.
   */
  const bodyValueRef = useRef(value);
  // Synced in an effect, never during render: an unrelated re-render mid-upload
  // (the busy counter, say) would otherwise reset the mirror to the value the
  // parent has not committed yet, and the previous image's marker would vanish.
  useEffect(() => {
    bodyValueRef.current = value;
  }, [value]);

  const placedIds = useMemo(() => collectEmailImageIds(value), [value]);

  /**
   * Every image the message references, whether or not it was uploaded in this
   * session — a marker is enough to rebuild the URL.
   */
  const imageUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const upload of uploads) map[upload.id] = upload.url;
    if (imageBaseUrl) {
      for (const imageId of placedIds) {
        if (!map[imageId]) {
          const url = emailImageUrlFrom(imageBaseUrl, imageId);
          if (url) map[imageId] = url;
        }
      }
    }
    return map;
  }, [uploads, placedIds, imageBaseUrl]);

  /** Tray rows: session uploads first, then anything already in the text. */
  const images = useMemo<ComposerImage[]>(() => {
    const rows: ComposerImage[] = uploads.map((upload) => ({
      ...upload,
      detached: !placedIds.includes(upload.id),
    }));
    for (const imageId of placedIds) {
      if (rows.some((row) => row.id === imageId)) continue;
      const url = imageUrls[imageId];
      if (!url) continue;
      rows.push({
        id: imageId,
        url,
        alt: altFromBody(value, imageId),
        width: 0,
        fileName: "already in this message",
        detached: false,
      });
    }
    return rows;
  }, [uploads, placedIds, imageUrls, value]);

  const busyRef = useRef(0);
  function addBusy(delta: number) {
    busyRef.current = Math.max(0, busyRef.current + delta);
    setUploading(busyRef.current);
    onBusyChange?.(busyRef.current);
  }

  function write(next: string) {
    bodyValueRef.current = next;
    onChange(next);
  }

  /** Write the marker into the message where the owner left the cursor. */
  function placeToken(imageId: string, alt: string) {
    const field = bodyRef.current;
    const current = bodyValueRef.current;
    // A textarea keeps its selection after it loses focus, so this is still the
    // spot the owner left the cursor before reaching for the Add image button.
    const start = field?.selectionStart ?? current.length;
    const end = field?.selectionEnd ?? current.length;

    const next = insertEmailImageToken(
      current,
      start,
      end,
      formatEmailImageToken(imageId, alt),
    );
    write(next.text);

    requestAnimationFrame(() => {
      if (!field) return;
      field.focus();
      field.setSelectionRange(next.caret, next.caret);
    });
  }

  /** Slots left: an uploaded image occupies one even before it is placed. */
  function roomLeft() {
    const held = new Set([...placedIds, ...uploads.map((u) => u.id)]);
    return EMAIL_IMAGE_MAX_PER_EMAIL - held.size;
  }

  async function addFiles(files: File[]) {
    const room = roomLeft();
    if (room <= 0) {
      toast.error(`One email can carry ${EMAIL_IMAGE_MAX_PER_EMAIL} images.`);
      return;
    }
    if (files.length > room) {
      toast.error(
        `Only ${room} more image${room === 1 ? "" : "s"} fits in this email.`,
      );
    }

    for (const file of files.slice(0, room)) {
      addBusy(1);
      try {
        if (exceedsEmailImageSizeLimit(file.size)) {
          toast.error(EMAIL_IMAGE_SIZE_LIMIT_MESSAGE);
          continue;
        }
        // Mac Photos and iPhone camera rolls default to HEIC, which Sharp on
        // Vercel cannot decode. Same browser-side conversion as profile media.
        const normalized = await normalizeProfileMediaFile(file);
        if (exceedsEmailImageSizeLimit(normalized.size)) {
          toast.error(EMAIL_IMAGE_SIZE_LIMIT_MESSAGE);
          continue;
        }

        const formData = new FormData();
        formData.set("file", normalized);
        const result = await uploadEmailImageAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          continue;
        }
        recordUpload(result, file.name);
      } catch {
        toast.error("We couldn't upload that image. Try a JPG or PNG.");
      } finally {
        addBusy(-1);
      }
    }
  }

  async function addFromUrl(url: string) {
    if (roomLeft() <= 0) {
      toast.error(`One email can carry ${EMAIL_IMAGE_MAX_PER_EMAIL} images.`);
      return;
    }
    addBusy(1);
    try {
      const result = await importEmailImageFromUrlAction(url);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      recordUpload(result, "pasted image");
    } catch {
      toast.error("We couldn't bring that image in. Try saving it first.");
    } finally {
      addBusy(-1);
    }
  }

  function recordUpload(
    result: { id: string; url: string; alt: string; width: number },
    fileName: string,
  ) {
    setUploads((current) => [
      ...current,
      {
        id: result.id,
        url: result.url,
        alt: result.alt,
        width: result.width,
        fileName,
      },
    ]);
    placeToken(result.id, result.alt);
  }

  /** Rewrite the marker in place so the description an owner edits is the one sent. */
  function changeAlt(imageId: string, alt: string) {
    setUploads((current) =>
      current.map((upload) =>
        upload.id === imageId ? { ...upload, alt } : upload,
      ),
    );
    write(replaceEmailImageToken(bodyValueRef.current, imageId, alt));
  }

  function removeImage(imageId: string) {
    setUploads((current) => current.filter((upload) => upload.id !== imageId));
    write(removeEmailImageToken(bodyValueRef.current, imageId));
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          id={id}
          ref={bodyRef}
          value={value}
          onChange={(event) => write(event.target.value)}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          className={cn(
            "w-full rounded-xl border p-3 text-sm leading-relaxed transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-surface-2",
            className,
          )}
          onPaste={(event) => {
            const data = event.clipboardData;
            const files = imageFilesFromTransfer(data);
            if (files.length > 0) {
              // A screenshot on the clipboard is an image, not text.
              event.preventDefault();
              void addFiles(files);
              return;
            }

            // No file: the picture may still be there as a remote <img> in the
            // HTML flavour, which is what copying out of a web page or a doc
            // produces. Fetch it rather than pasting the markup as text.
            const html = data?.getData("text/html") ?? "";
            const remote = imageUrlFromPastedHtml(html);
            if (remote) {
              event.preventDefault();
              void addFromUrl(remote);
              return;
            }

            // A file was on the clipboard but nothing usable came of it — say so
            // rather than swallowing the paste, which is how this looked broken.
            if (transferHasFile(data) && !html) {
              event.preventDefault();
              toast.error(
                "That paste didn't carry an image we can read. Save it as a JPG or PNG and drag it in.",
              );
            }
            // Otherwise it is ordinary text: let the browser paste it.
          }}
          onDragOver={(event) => {
            if (!transferHasFile(event.dataTransfer)) return;
            // Both dragover and drop must be prevented, or the browser navigates
            // away to the dropped file and loses the draft.
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            setDragging(false);
            if (!transferHasFile(event.dataTransfer)) return;
            event.preventDefault();
            const files = imageFilesFromTransfer(event.dataTransfer);
            if (files.length === 0) {
              toast.error(
                "That file isn't an image we can use. Try a JPG, PNG or WebP.",
              );
              return;
            }
            void addFiles(files);
          }}
        />
        {dragging ? (
          <p
            className="border-primary bg-background/90 text-primary pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed text-sm font-medium"
            aria-hidden
          >
            Drop to add the image here
          </p>
        ) : null}
      </div>

      {help}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGES}
        multiple
        className="hidden"
        aria-label="Add an image to this email"
        onChange={(event) => {
          void addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      <EmailImageTray
        images={images}
        uploading={uploading}
        disabled={disabled}
        onPick={() => fileRef.current?.click()}
        onAltChange={changeAlt}
        onInsert={(imageId) => {
          const image = images.find((row) => row.id === imageId);
          if (image) placeToken(image.id, image.alt);
        }}
        onRemove={removeImage}
      />

      {showPreview ? (
        <EmailBodyPreview
          body={value}
          imageUrls={imageUrls}
          unsubscribeNote={unsubscribeNote}
        />
      ) : null}
    </div>
  );
}

/** Read an image's current description straight out of the message text. */
function altFromBody(body: string, imageId: string): string {
  const match = new RegExp(
    `\\[image:${imageId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\|([^\\]\\n]{0,200}))?\\]`,
  ).exec(body);
  return match?.[1] ?? "";
}
