"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Store } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingProgress } from "@/components/scl/onboarding-progress";
import { AccountTrustSummary } from "@/components/scl/account-trust";
import { ProfileCompletionPanel } from "@/components/scl/profile-completion";
import { ProfileIdentityPreview } from "@/components/scl/profile-identity-preview";
import { ProfileMediaEditor } from "@/components/scl/profile-media-editor";
import { ProfileTagInput } from "@/components/scl/profile-tag-input";
import { StorefrontPreview } from "@/components/scl/storefront-preview";
import { SPORTS } from "@/lib/constants";
import { SUPPORTED_BOOKS } from "@/lib/books";
import { calculateProfileCompletion } from "@/lib/profile-completion";
import {
  resolveStorefrontIdentity,
  STOREFRONT_DESCRIPTION_MAX_LENGTH,
  STOREFRONT_TITLE_MAX_LENGTH,
} from "@/lib/storefront";
import {
  profileSchema,
  type ProfileFormInput,
  type ProfileInput,
  BET_TYPES,
  DAILY_VOLUMES,
  OFFERING_MODELS,
} from "@/lib/schemas/profile.schema";
import { updateProfileAction } from "@/lib/actions/profile.action";
import { formatHandle } from "@/lib/identity";
import type { CapperProfileView } from "@/lib/queries/profile";

const inputClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 min-h-11 w-full rounded-lg border bg-transparent px-3 text-base shadow-xs focus-visible:ring-[3px] focus-visible:outline-none md:text-sm";

export function ProfileForm({ profile }: { profile: CapperProfileView }) {
  const router = useRouter();
  const [media, setMedia] = useState({
    avatarUrl: profile.avatarUrl,
    bannerUrl: profile.bannerUrl,
  });
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      providerType: profile.providerType,
      sports: profile.sports,
      books: profile.books,
      specialties: profile.specialties,
      betTypes: profile.betTypes,
      dailyVolume: profile.dailyVolume ?? "",
      writtenAnalysis: profile.writtenAnalysis,
      biggestBetWon: profile.biggestBetWon ?? "",
      storefrontTitle: profile.storefrontTitle ?? "",
      storefrontDescription: profile.storefrontDescription ?? "",
      storefrontEnabled: profile.storefrontEnabled,
    },
  });

  const values = useWatch({ control });
  const username = profile.user.username ?? "";
  const handleLabel = formatHandle(username) ?? "";
  const completion = calculateProfileCompletion({
    ...values,
    avatarUrl: media.avatarUrl,
    bannerUrl: media.bannerUrl,
    providerType: values.providerType,
    betTypes: values.betTypes,
    dailyVolume:
      values.dailyVolume === "" ? null : (values.dailyVolume ?? null),
  });
  const storefront = resolveStorefrontIdentity({
    username,
    title: values.storefrontTitle,
    description: values.storefrontDescription,
    enabled: values.storefrontEnabled ?? true,
  });

  async function onSubmit(valuesToSave: ProfileInput) {
    const result = await updateProfileAction(valuesToSave);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Public profile saved");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <AccountTrustSummary
        status={profile.user.accountStatus}
        emailVerified={Boolean(profile.user.emailVerified)}
        acceptedAt={profile.user.termsAcceptances[0]?.acceptedAt}
        policyVersion={profile.user.termsAcceptances[0]?.policyVersion}
      />

      <div className="border-border bg-card rounded-xl border px-4 py-4 sm:px-5">
        <OnboardingProgress
          emailVerified={Boolean(profile.user.emailVerified)}
          profileComplete={completion.isComplete}
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="min-w-0 space-y-5"
          noValidate
        >
          <ProfileMediaEditor
            name={username || "scl"}
            avatarUrl={media.avatarUrl}
            bannerUrl={media.bannerUrl}
            onChange={(kind, url) =>
              setMedia((current) => ({
                ...current,
                [kind === "avatar" ? "avatarUrl" : "bannerUrl"]: url,
              }))
            }
          />

          <section
            aria-labelledby="identity-title"
            className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5"
          >
            <div>
              <h2 id="identity-title" className="font-semibold">
                Public Identity
              </h2>
              <p className="text-muted-foreground text-sm">
                Your @handle is your public name across SCL.
              </p>
            </div>

            <Field htmlFor="username" label="SCL Handle">
              <Input
                id="username"
                value={handleLabel || `@${username}`}
                disabled
              />
            </Field>

            <Field
              htmlFor="headline"
              label="Capper Headline"
              error={errors.headline?.message}
            >
              <Input
                id="headline"
                placeholder="Data-backed NBA sides and player props"
                {...register("headline")}
              />
            </Field>

            <Field htmlFor="bio" label="About" error={errors.bio?.message}>
              <textarea
                id="bio"
                rows={5}
                className={`${inputClass} py-2`}
                placeholder="Describe your process, market focus, and what bettors can expect from your record."
                {...register("bio")}
              />
            </Field>
          </section>

          <section
            aria-labelledby="storefront-title"
            className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <span className="bg-surface-2 text-brand flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Store className="size-4" aria-hidden />
              </span>
              <div>
                <h2 id="storefront-title" className="font-semibold">
                  Default Storefront
                </h2>
                <p className="text-muted-foreground text-sm">
                  The storefront identity shown before packages are connected.
                </p>
              </div>
            </div>

            <label className="border-border bg-surface-2 flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="accent-brand size-4"
                {...register("storefrontEnabled")}
              />
              <span>
                <span className="block font-medium">
                  Show storefront on my public profile
                </span>
                <span className="text-muted-foreground block text-xs">
                  You can hide it until you are ready to market packages.
                </span>
              </span>
            </label>

            <Field
              htmlFor="storefrontTitle"
              label="Storefront Title"
              error={errors.storefrontTitle?.message}
            >
              <Input
                id="storefrontTitle"
                maxLength={STOREFRONT_TITLE_MAX_LENGTH}
                placeholder={storefront.title}
                {...register("storefrontTitle")}
              />
            </Field>

            <Field
              htmlFor="storefrontDescription"
              label="Storefront Description"
              error={errors.storefrontDescription?.message}
            >
              <textarea
                id="storefrontDescription"
                rows={3}
                maxLength={STOREFRONT_DESCRIPTION_MAX_LENGTH}
                className={`${inputClass} py-2`}
                placeholder={storefront.description}
                {...register("storefrontDescription")}
              />
            </Field>
          </section>

          <section
            aria-labelledby="coverage-title"
            className="border-border bg-card space-y-5 rounded-xl border p-4 sm:p-5"
          >
            <div>
              <h2 id="coverage-title" className="font-semibold">
                Coverage And Approach
              </h2>
              <p className="text-muted-foreground text-sm">
                Define the markets behind your public record.
              </p>
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Sports</legend>
              <div className="flex flex-wrap gap-2">
                {SPORTS.map((sport) => (
                  <Chip
                    key={sport.key}
                    value={sport.key}
                    label={sport.label}
                    {...register("sports")}
                  />
                ))}
              </div>
              {errors.sports ? (
                <p className="text-neg text-xs">{errors.sports.message}</p>
              ) : null}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">My sportsbooks</legend>
              <p className="text-muted-foreground text-xs">
                Books you bet — used later to filter board prices. Leave empty
                to use all US books.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_BOOKS.map((book) => (
                  <Chip
                    key={book.key}
                    value={book.key}
                    label={book.label}
                    {...register("books")}
                  />
                ))}
              </div>
              {errors.books ? (
                <p className="text-neg text-xs">{errors.books.message}</p>
              ) : null}
            </fieldset>

            <Field
              htmlFor="specialty"
              label="Specialties"
              error={errors.specialties?.message}
            >
              <ProfileTagInput
                value={values.specialties ?? []}
                onChange={(next) =>
                  setValue("specialties", next, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </Field>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Bet Types</legend>
              <div className="flex flex-wrap gap-2">
                {BET_TYPES.map((betType) => (
                  <Chip
                    key={betType.value}
                    value={betType.value}
                    label={betType.label}
                    {...register("betTypes")}
                  />
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                htmlFor="providerType"
                label="Offering Model"
                error={errors.providerType?.message}
              >
                <select
                  id="providerType"
                  className={`${inputClass} h-11 md:h-9`}
                  {...register("providerType")}
                >
                  {OFFERING_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                htmlFor="dailyVolume"
                label="Daily Volume"
                error={errors.dailyVolume?.message}
              >
                <select
                  id="dailyVolume"
                  className={`${inputClass} h-11 md:h-9`}
                  {...register("dailyVolume")}
                >
                  <option value="">Not Set</option>
                  {DAILY_VOLUMES.map((volume) => (
                    <option key={volume.value} value={volume.value}>
                      {volume.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field
              htmlFor="biggestBetWon"
              label="Signature Result"
              error={errors.biggestBetWon?.message}
            >
              <Input
                id="biggestBetWon"
                placeholder="+18.4u on a four-leg parlay"
                {...register("biggestBetWon")}
              />
            </Field>

            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-brand size-4"
                {...register("writtenAnalysis")}
              />
              Written analysis accompanies my plays
            </label>
          </section>

          <div className="border-border bg-card sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 rounded-xl border p-3 shadow-lg">
            <span className="text-muted-foreground hidden text-sm sm:block">
              {handleLabel}
            </span>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full gap-2 sm:w-auto"
            >
              <Save className="size-4" />
              {isSubmitting ? "Saving…" : "Save Public Profile"}
            </Button>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <ProfileCompletionPanel completion={completion} />
          <ProfileIdentityPreview
            profile={{
              username,
              headline: values.headline,
              avatarUrl: media.avatarUrl,
              bannerUrl: media.bannerUrl,
              sports: values.sports ?? [],
              verified: Boolean(profile.user.emailVerified),
            }}
          />
          <StorefrontPreview storefront={storefront} />
        </aside>
      </div>
    </div>
  );
}

function Field({
  htmlFor,
  label,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
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
      <span className="border-border text-muted-foreground peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-brand inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium transition-colors select-none md:min-h-9">
        {label}
      </span>
    </label>
  );
}
