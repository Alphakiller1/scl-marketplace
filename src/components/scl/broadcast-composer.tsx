"use client";

import { useMemo, useRef, useState } from "react";
import { Send, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailBodyPreview } from "@/components/scl/email-body-preview";
import {
  EmailImageTray,
  type ComposerImage,
} from "@/components/scl/email-image-tray";
import {
  previewBroadcastAudienceAction,
  sendBroadcastAction,
} from "@/lib/actions/broadcast.action";
import { uploadEmailImageAction } from "@/lib/actions/email-image.action";
import {
  collectEmailImageIds,
  EMAIL_IMAGE_MAX_PER_EMAIL,
  formatEmailImageToken,
  insertEmailImageToken,
  removeEmailImageToken,
  replaceEmailImageToken,
} from "@/lib/email-image";
import { normalizeProfileMediaFile } from "@/lib/profile-media-client";
import type { BroadcastInput } from "@/lib/schemas/broadcast.schema";
import {
  EMAIL_IMAGE_SIZE_LIMIT_MESSAGE,
  exceedsEmailImageSizeLimit,
} from "@/lib/schemas/email-image.schema";

type Audience = BroadcastInput["audience"];

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  {
    value: "ALL_CAPPERS",
    label: "All cappers",
    hint: "Everyone active, minus opt-outs and unreachable addresses.",
  },
  {
    value: "VERIFIED_CAPPERS",
    label: "Verified only",
    hint: "Cappers who have confirmed their email.",
  },
  {
    value: "SINGLE_CAPPER",
    label: "One capper",
    hint: "A direct message about their account. Always delivers.",
  },
];

const ACCEPTED_IMAGES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export function BroadcastComposer({
  cappers,
}: {
  cappers: { id: string; label: string }[];
}) {
  const [audience, setAudience] = useState<Audience>("ALL_CAPPERS");
  const [userId, setUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Omit<ComposerImage, "detached">[]>([]);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * Mirrors `body` so an insert can read the latest text synchronously. Uploads
   * are awaited one at a time, but reading state through a closure still hands
   * back the value from the render the loop started in, which would drop the
   * previous image's token.
   */
  const bodyValueRef = useRef("");

  function writeBody(next: string) {
    bodyValueRef.current = next;
    setBody(next);
  }

  const isMass = audience !== "SINGLE_CAPPER";

  const placedIds = useMemo(() => collectEmailImageIds(body), [body]);
  const images = useMemo<ComposerImage[]>(
    () =>
      uploads.map((upload) => ({
        ...upload,
        detached: !placedIds.includes(upload.id),
      })),
    [uploads, placedIds],
  );
  const imageUrls = useMemo(
    () => Object.fromEntries(uploads.map((u) => [u.id, u.url])),
    [uploads],
  );

  /** Write the token into the message where the owner left the cursor. */
  function placeToken(id: string, alt: string) {
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
      formatEmailImageToken(id, alt),
    );
    writeBody(next.text);

    // Once React has written the new value, put the caret after the image —
    // otherwise the next keystroke lands wherever the old offset now points.
    requestAnimationFrame(() => {
      if (!field) return;
      field.focus();
      field.setSelectionRange(next.caret, next.caret);
    });
  }

  async function addImages(files: File[]) {
    const room = EMAIL_IMAGE_MAX_PER_EMAIL - uploads.length;
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
      setUploading((n) => n + 1);
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

        setUploads((current) => [
          ...current,
          {
            id: result.id,
            url: result.url,
            alt: result.alt,
            width: result.width,
            fileName: file.name,
          },
        ]);
        placeToken(result.id, result.alt);
      } catch {
        toast.error("We couldn't upload that image. Try a JPG or PNG.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  /** Rewrite the token in place so the alt text an owner edits is the one sent. */
  function changeAlt(id: string, alt: string) {
    setUploads((current) =>
      current.map((upload) => (upload.id === id ? { ...upload, alt } : upload)),
    );
    writeBody(replaceEmailImageToken(bodyValueRef.current, id, alt));
  }

  function removeImage(id: string) {
    setUploads((current) => current.filter((upload) => upload.id !== id));
    writeBody(removeEmailImageToken(bodyValueRef.current, id));
  }

  /**
   * Is a file being dragged over the message?
   *
   * Only `kind` and `type` are readable during a drag — `getAsFile()` returns
   * null until the drop — and a HEIC out of Finder often arrives with no MIME
   * type at all, so this asks the one question that can be answered: is it a
   * file? What it actually is gets decided on drop, where it can be reported.
   */
  function isFileDrag(items: DataTransferItemList | null): boolean {
    if (!items) return false;
    return Array.from(items).some((item) => item.kind === "file");
  }

  async function preview() {
    setBusy(true);
    try {
      const result = await previewBroadcastAudienceAction({ audience, userId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCount(result.count);
    } catch {
      toast.error("Couldn't check the recipient count. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      const result = await sendBroadcastAction({
        audience,
        userId: userId || undefined,
        subject,
        body,
        // Sending to more people than the admin was shown is the one mistake
        // here that cannot be undone, so the confirmed count is sent back and
        // the server refuses if the roster moved.
        confirmRecipientCount: isMass && count !== null ? count : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        setCount(null);
        return;
      }
      toast.success(
        isMass
          ? `Mass email queued for ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"}.`
          : "Email queued for delivery.",
      );
      setSubject("");
      writeBody("");
      setUploads([]);
      setCount(null);
    } catch {
      toast.error("Couldn't queue the email. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const ready =
    subject.trim().length >= 3 &&
    body.trim().length >= 10 &&
    uploading === 0 &&
    (!isMass || count !== null) &&
    (audience !== "SINGLE_CAPPER" || Boolean(userId));

  return (
    <Card className="space-y-4 p-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Audience</legend>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => {
                setAudience(a.value);
                setCount(null);
              }}
              aria-pressed={audience === a.value}
              className={`min-h-10 rounded-xl border px-3 text-sm transition-colors ${
                audience === a.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface-2 text-muted-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {AUDIENCES.find((a) => a.value === audience)?.hint}
        </p>
      </fieldset>

      {audience === "SINGLE_CAPPER" ? (
        <div className="space-y-1.5">
          <Label htmlFor="capper">Capper</Label>
          <select
            id="capper"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="border-border bg-surface-2 min-h-10 w-full rounded-xl border px-3 text-sm"
          >
            <option value="">Choose a capper…</option>
            {cappers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="min-h-10"
          maxLength={150}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Message</Label>
        <div className="relative">
          <textarea
            id="body"
            ref={bodyRef}
            value={body}
            onChange={(e) => writeBody(e.target.value)}
            rows={8}
            maxLength={10000}
            className={`w-full rounded-xl border p-3 text-sm leading-relaxed transition-colors ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-border bg-surface-2"
            }`}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData?.files ?? []).filter(
                (file) => file.type.startsWith("image/"),
              );
              // Pasted text must paste normally; only take over for a screenshot.
              if (files.length === 0) return;
              event.preventDefault();
              void addImages(files);
            }}
            onDragOver={(event) => {
              if (!isFileDrag(event.dataTransfer.items)) return;
              // Both dragover and drop must be prevented, or the browser
              // navigates away to the dropped file and loses the draft.
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              setDragging(false);
              const files = Array.from(event.dataTransfer.files);
              if (files.length === 0) return;
              event.preventDefault();
              void addImages(files);
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
        <p className="text-muted-foreground text-xs">
          Plain text. Blank lines become paragraphs, and each{" "}
          <code className="text-foreground">[image:…]</code> marks where a
          picture goes — move or delete it like any other text.
          {isMass
            ? " An unsubscribe link is added automatically. Each address is sent privately in Resend batches of up to 100."
            : ""}
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGES}
        multiple
        className="hidden"
        aria-label="Add an image to this email"
        onChange={(event) => {
          void addImages(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      <EmailImageTray
        images={images}
        uploading={uploading}
        disabled={busy}
        onPick={() => fileRef.current?.click()}
        onAltChange={changeAlt}
        onInsert={(id) => {
          const image = uploads.find((upload) => upload.id === id);
          if (image) placeToken(image.id, image.alt);
        }}
        onRemove={removeImage}
      />

      <EmailBodyPreview
        body={body}
        imageUrls={imageUrls}
        unsubscribeNote={isMass}
      />

      <div className="flex flex-wrap items-center gap-2">
        {isMass ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            disabled={busy}
            onClick={() => void preview()}
          >
            <Users className="size-4" aria-hidden />
            {count === null ? "Check who this reaches" : "Re-check"}
          </Button>
        ) : null}

        <Button
          type="button"
          className="min-h-10"
          disabled={busy || !ready}
          onClick={() => void send()}
        >
          <Send className="size-4" aria-hidden />
          {isMass && count !== null ? `Send to ${count}` : "Send"}
        </Button>

        {isMass && count !== null ? (
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {count} recipient{count === 1 ? "" : "s"} after opt-outs and
            unreachable addresses.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
