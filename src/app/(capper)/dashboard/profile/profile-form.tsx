"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { SPORTS } from "@/lib/constants";
import {
  profileSchema,
  type ProfileFormInput,
  type ProfileInput,
  BET_TYPES,
  DAILY_VOLUMES,
  PROVIDER_TYPES,
} from "@/lib/schemas/profile.schema";
import { updateProfileAction } from "@/lib/actions/profile.action";
import type { CapperProfileView } from "@/lib/queries/profile";

const inputClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:outline-none";

export function ProfileForm({ profile }: { profile: CapperProfileView }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      providerType: profile.providerType,
      sports: profile.sports,
      betTypes: profile.betTypes,
      dailyVolume: profile.dailyVolume ?? "",
      writtenAnalysis: profile.writtenAnalysis,
      biggestBetWon: profile.biggestBetWon ?? "",
      instagram: profile.instagram ?? "",
      twitter: profile.twitter ?? "",
      facebook: profile.facebook ?? "",
      tiktok: profile.tiktok ?? "",
      website: profile.website ?? "",
    },
  });

  async function onSubmit(values: ProfileInput) {
    const res = await updateProfileAction(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Profile saved");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* About */}
      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">About</h2>
        <Field label="Headline" error={errors.headline?.message}>
          <Input
            placeholder="Data-backed NBA & NFL picks"
            {...register("headline")}
          />
        </Field>
        <Field label="Bio" error={errors.bio?.message}>
          <textarea
            rows={4}
            className={`${inputClass} py-2`}
            placeholder="Tell bettors how you handicap and what makes your record worth following."
            {...register("bio")}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Provider type" error={errors.providerType?.message}>
            <select
              className={`${inputClass} h-9`}
              {...register("providerType")}
            >
              {PROVIDER_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Daily volume" error={errors.dailyVolume?.message}>
            <select
              className={`${inputClass} h-9`}
              {...register("dailyVolume")}
            >
              <option value="">Not set</option>
              {DAILY_VOLUMES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field
          label="Biggest bet won (optional)"
          error={errors.biggestBetWon?.message}
        >
          <Input
            placeholder="e.g. +18.4u on a 4-leg parlay"
            {...register("biggestBetWon")}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-brand size-4"
            {...register("writtenAnalysis")}
          />
          I provide written analysis with my picks
        </label>
      </Card>

      {/* Sports */}
      <Card className="space-y-3 p-6">
        <h2 className="font-semibold">Sports</h2>
        <p className="text-muted-foreground text-sm">What do you handicap?</p>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <Chip
              key={s.key}
              value={s.key}
              label={s.label}
              {...register("sports")}
            />
          ))}
        </div>
      </Card>

      {/* Bet types */}
      <Card className="space-y-3 p-6">
        <h2 className="font-semibold">Bet types</h2>
        <div className="flex flex-wrap gap-2">
          {BET_TYPES.map((b) => (
            <Chip
              key={b.value}
              value={b.value}
              label={b.label}
              {...register("betTypes")}
            />
          ))}
        </div>
      </Card>

      {/* Socials */}
      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Links</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram" error={errors.instagram?.message}>
            <Input placeholder="@handle" {...register("instagram")} />
          </Field>
          <Field label="X (Twitter)" error={errors.twitter?.message}>
            <Input placeholder="@handle" {...register("twitter")} />
          </Field>
          <Field label="Facebook" error={errors.facebook?.message}>
            <Input placeholder="username" {...register("facebook")} />
          </Field>
          <Field label="TikTok" error={errors.tiktok?.message}>
            <Input placeholder="@handle" {...register("tiktok")} />
          </Field>
        </div>
        <Field label="Website" error={errors.website?.message}>
          <Input placeholder="https://…" {...register("website")} />
        </Field>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-neg text-xs">{error}</p> : null}
    </div>
  );
}

function Chip({
  value,
  label,
  ...register
}: {
  value: string;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        value={value}
        className="peer sr-only"
        {...register}
      />
      <span className="border-border text-muted-foreground peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand inline-flex rounded-full border px-3 py-1 text-sm font-medium transition-colors select-none">
        {label}
      </span>
    </label>
  );
}
