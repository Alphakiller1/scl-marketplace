"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { uploadProfileMediaAction } from "@/lib/actions/profile-media.action";
import type { ProfileMediaKind } from "@/lib/schemas/profile-media.schema";

type ProfileMediaEditorProps = {
  displayName: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  onChange: (kind: ProfileMediaKind, url: string) => void;
};

export function ProfileMediaEditor({
  displayName,
  avatarUrl,
  bannerUrl,
  onChange,
}: ProfileMediaEditorProps) {
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<ProfileMediaKind | null>(null);

  async function upload(kind: ProfileMediaKind, file?: File) {
    if (!file) return;
    setUploading(kind);

    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("file", file);
    const result = await uploadProfileMediaAction(formData);

    setUploading(null);
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
  }

  return (
    <section
      aria-labelledby="profile-media-title"
      className="border-border bg-card overflow-hidden rounded-xl border"
    >
      <div className="border-border border-b px-4 py-4 sm:px-5">
        <h2 id="profile-media-title" className="font-semibold">
          Profile Media
        </h2>
        <p className="text-muted-foreground text-sm">
          Build a recognizable identity across rankings and public profiles.
        </p>
      </div>

      <div className="relative">
        <div className="bg-surface-2 relative h-28 w-full overflow-hidden sm:h-36">
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div aria-hidden className="scl-glow absolute inset-0 size-full" />
          )}
          <Button
            type="button"
            variant="secondary"
            className="absolute right-3 bottom-3 min-h-11 gap-1.5 sm:min-h-10"
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
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="Upload cover image"
            onChange={(event) => {
              void upload("banner", event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>

        <div className="flex items-end justify-between gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="bg-card -mt-8 rounded-xl p-1">
            <CapperAvatar
              name={displayName}
              src={avatarUrl ?? undefined}
              size="xl"
              className="size-16 text-base sm:size-20 sm:text-xl"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 gap-1.5 sm:min-h-10"
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
            accept="image/jpeg,image/png,image/webp"
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
