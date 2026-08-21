"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperBanner } from "@/components/scl/capper-banner";
import { uploadProfileMediaAction } from "@/lib/actions/profile-media.action";
import { normalizeProfileMediaFile } from "@/lib/profile-media-client";
import type { ProfileMediaKind } from "@/lib/schemas/profile-media.schema";

type ProfileMediaEditorProps = {
  /** Seed for avatar initials — typically the @username without @. */
  name: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  onChange: (kind: ProfileMediaKind, url: string) => void;
  /** Position in the profile form's step sequence, e.g. "Step 1 of 4". */
  eyebrow?: string;
};

export function ProfileMediaEditor({
  name,
  avatarUrl,
  bannerUrl,
  onChange,
  eyebrow,
}: ProfileMediaEditorProps) {
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<ProfileMediaKind | null>(null);

  async function upload(kind: ProfileMediaKind, file?: File) {
    if (!file) return;
    setUploading(kind);

    try {
      const normalized = await normalizeProfileMediaFile(file);
      const formData = new FormData();
      formData.set("kind", kind);
      formData.set("file", normalized);

      const result = await uploadProfileMediaAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      onChange(result.kind, result.url);
      toast.success(
        result.kind === "avatar"
          ? "Profile image updated"
          : "Cover image updated",
      );
    } catch {
      toast.error(
        "We couldn't upload that image. Try a JPG, PNG, or HEIC under 5 MB.",
      );
    } finally {
      setUploading(null);
    }
  }

  return (
    <section
      aria-labelledby="profile-media-title"
      className="border-border bg-card overflow-hidden rounded-xl border"
    >
      <div className="border-border border-b px-4 py-4 sm:px-5">
        {eyebrow ? (
          <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h2 id="profile-media-title" className="font-semibold">
          Profile Media
        </h2>
        <p className="text-muted-foreground text-sm">
          Build a recognizable identity across rankings and public profiles.
        </p>
      </div>

      <div className="relative">
        <CapperBanner src={bannerUrl} heightClass="h-28 w-full sm:h-36" />
        <Button
          type="button"
          variant="secondary"
          className="absolute top-3 right-3 z-10 gap-1.5 sm:min-h-10"
          onClick={() => bannerInput.current?.click()}
          disabled={uploading !== null}
        >
          {uploading === "banner" ? (
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          Cover
        </Button>
        <input
          ref={bannerInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          className="hidden"
          aria-label="Upload cover image"
          onChange={(event) => {
            void upload("banner", event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <div className="flex flex-wrap items-end justify-between gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="bg-card -mt-8 rounded-xl p-1">
            <CapperAvatar name={name} src={avatarUrl ?? undefined} size="xl" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-3 shrink-0 gap-1.5 sm:min-h-10"
            onClick={() => avatarInput.current?.click()}
            disabled={uploading !== null}
          >
            {uploading === "avatar" ? (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <Camera className="size-4" />
            )}
            Profile Image
          </Button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            className="hidden"
            aria-label="Upload profile image"
            onChange={(event) => {
              void upload("avatar", event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </div>
    </section>
  );
}
