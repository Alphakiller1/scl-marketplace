"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Controller,
  useForm,
  useWatch,
  type FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save, Store } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingProgress } from "@/components/scl/onboarding-progress";
import { AccountTrustSummary } from "@/components/scl/account-trust";
import { LeagueMark } from "@/components/scl/league-mark";
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
import {
  PROFILE_USERNAME_API_PATH,
  parseUsernameSavePayload,
} from "@/lib/profile-username-api";
import { formatHandle } from "@/lib/identity";
import type { CapperProfileView } from "@/lib/queries/profile";

const inputClass =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 w-full rounded-lg border bg-transparent px-3 text-base shadow-xs focus-visible:ring-[3px] focus-visible:outline-none md:text-sm";

/**
 * Media → identity → coverage → storefront. The page carried four unnumbered
 * cards in a different order, which read as an arbitrary pile; numbering them
 * makes the sequence legible and keeps the commerce step at the end.
 */
const TOTAL_STEPS = 4;

function StepHeading({
  id,
  step,
  title,
  subtitle,
}: {
  id: string;
  step: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
        Step {step} of {TOTAL_STEPS}
      </p>
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      <p className="text-muted-foreground text-sm">{subtitle}</p>
    </div>
  );
}

function stripHandlePrefix(value: string) {
  return value.replace(/^@+/, "").trim();
}

function usernameSavedMessage(username: string) {
  return `@${username} saved — your public profile URL updated.`;
}

export function ProfileForm({ profile }: { profile: CapperProfileView }) {
  const router = useRouter();
  const initialHandle = stripHandlePrefix(profile.user.username ?? "");
  const handleInputRef = useRef<HTMLInputElement | null>(null);
  const capturedHandleRef = useRef(initialHandle);
  const handleSnapshotLockedRef = useRef(false);
  const [handleUnlocked, setHandleUnlocked] = useState(false);
  const [media, setMedia] = useState({
    avatarUrl: profile.avatarUrl,
    bannerUrl: profile.bannerUrl,
  });
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormInput, unknown, ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: initialHandle,
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
  const username = stripHandlePrefix(values.username ?? "");

  function captureHandle() {
    if (handleSnapshotLockedRef.current) return;
    const live = handleInputRef.current?.value;
    if (typeof live === "string") {
      capturedHandleRef.current = live;
    }
    handleSnapshotLockedRef.current = true;
  }
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

  function onInvalid(formErrors: FieldErrors<ProfileFormInput>) {
    const first = Object.values(formErrors).find(
      (issue) => issue && "message" in issue && issue.message,
    );
    toast.error(
      typeof first?.message === "string"
        ? first.message
        : "Fix the highlighted fields and try again.",
    );
  }

  async function persistCapturedUsername() {
    // Do not re-read the live input here. Password managers overwrite it
    // between pointerdown and submit; capturedHandleRef is the typed value.
    // Fetch JSON instead of a Server Action — Origin/Host mismatches and
    // Safari action POSTs were throwing a digest toasted as
    // "We couldn't save your profile".
    try {
      const response = await fetch(PROFILE_USERNAME_API_PATH, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ username: capturedHandleRef.current }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return {
          ok: false as const,
          error:
            response.status === 401 || response.redirected
              ? "Sign in again to change your username."
              : "We couldn't save your username. Try again.",
        };
      }
      return parseUsernameSavePayload(await response.json());
    } catch {
      return {
        ok: false as const,
        error: "We couldn't save your username. Try again.",
      };
    } finally {
      handleSnapshotLockedRef.current = false;
    }
  }

  async function saveUsernameThenProfile(valuesToSave?: ProfileInput) {
    const usernameResult = await persistCapturedUsername();
    if (!usernameResult.ok) {
      toast.error(usernameResult.error);
      return false;
    }

    if (!valuesToSave) {
      if (usernameResult.usernameChanged) {
        toast.success(usernameSavedMessage(usernameResult.username));
        router.refresh();
      }
      return usernameResult.usernameChanged;
    }

    try {
      const result = await updateProfileAction({
        ...valuesToSave,
        username: usernameResult.username,
      });
      if (!result.ok) {
        if (usernameResult.usernameChanged) {
          toast.success(usernameSavedMessage(usernameResult.username));
        }
        toast.error(result.error);
        router.refresh();
        return false;
      }
      reset({ ...valuesToSave, username: usernameResult.username });
      toast.success(
        usernameResult.usernameChanged || result.usernameChanged
          ? usernameSavedMessage(usernameResult.username)
          : "Public profile saved",
      );
      router.refresh();
      return true;
    } catch {
      if (usernameResult.usernameChanged) {
        toast.success(usernameSavedMessage(usernameResult.username));
        toast.error(
          "Username saved, but the rest of the profile did not. Try again.",
        );
        router.refresh();
        return true;
      }
      toast.error("We couldn't complete the save. Refresh and try again.");
      return false;
    }
  }

  return (
    <div className="space-y-6">
      {/* Account standing and setup progress are both "where you stand" — one
          band, so the page opens with status and then moves into editing
          rather than alternating between the two. */}
      <div className="border-border bg-card divide-border w-full max-w-full min-w-0 divide-y overflow-hidden rounded-xl border">
        <div className="min-w-0 p-4 sm:p-5">
          <AccountTrustSummary
            status={profile.user.accountStatus}
            emailVerified={Boolean(profile.user.emailVerified)}
            acceptedAt={profile.user.termsAcceptances[0]?.acceptedAt}
            policyVersion={profile.user.termsAcceptances[0]?.policyVersion}
          />
        </div>
        <div className="px-4 py-4 sm:px-5">
          <OnboardingProgress
            emailVerified={Boolean(profile.user.emailVerified)}
            profileComplete={completion.isComplete}
          />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form
          autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === "Enter") captureHandle();
          }}
          onSubmit={(event) =>
            handleSubmit(
              (valuesToSave) => saveUsernameThenProfile(valuesToSave),
              async (formErrors) => {
                await saveUsernameThenProfile();
                onInvalid(formErrors);
              },
            )(event)
          }
          className="min-w-0 space-y-5"
          noValidate
        >
          <ProfileMediaEditor
            eyebrow={`Step 1 of ${TOTAL_STEPS}`}
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
            <StepHeading
              id="identity-title"
              step={2}
              title="Public Identity"
              subtitle="Your @handle is your public name across SCL. Changing it updates your public profile URL."
            />

            <Field
              htmlFor="scl-public-handle"
              label="Public handle"
              error={errors.username?.message}
            >
              {/* The only `name="username"` field. Password managers treat a
                  visible handle named username as a login field and overwrite
                  it with the old @handle on Save — that is why mtndegwn never
                  became mtndegen. */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                tabIndex={-1}
                aria-hidden
                className="sr-only"
                defaultValue=""
              />
              <div className="relative">
                <span
                  aria-hidden
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
                >
                  @
                </span>
                <Controller
                  name="username"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      ref={(element) => {
                        field.ref(element);
                        handleInputRef.current =
                          element instanceof HTMLInputElement ? element : null;
                      }}
                      id="scl-public-handle"
                      name="scl-public-handle"
                      readOnly={!handleUnlocked}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      data-1p-ignore
                      data-lpignore="true"
                      data-form-type="other"
                      className="pl-7"
                      placeholder="your_username"
                      onFocus={(event) => {
                        setHandleUnlocked(true);
                        event.currentTarget.removeAttribute("readOnly");
                      }}
                      onPointerDown={() => setHandleUnlocked(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") captureHandle();
                      }}
                      onChange={(event) => {
                        field.onChange(event);
                        if (!handleSnapshotLockedRef.current) {
                          capturedHandleRef.current = event.target.value;
                        }
                      }}
                    />
                  )}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                3–30 characters. Letters, numbers, and underscores only. This is
                your public @handle, not your login.
              </p>
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
            aria-labelledby="coverage-title"
            className="border-border bg-card space-y-5 rounded-xl border p-4 sm:p-5"
          >
            <StepHeading
              id="coverage-title"
              step={3}
              title="Coverage And Approach"
              subtitle="Define the markets behind your public record."
            />

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Sports</legend>
              <div className="flex flex-wrap gap-2">
                {SPORTS.map((sport) => (
                  <Chip
                    key={sport.key}
                    value={sport.key}
                    label={sport.label}
                    withLeagueMark
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

          {/* Commerce last: identity and coverage describe the capper, the
              storefront sells them. It used to sit between the two, splitting
              the profile in half. */}
          <section
            aria-labelledby="storefront-title"
            className="border-border bg-card space-y-4 rounded-xl border p-4 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <span className="bg-surface-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-[color:var(--scl-blue)]">
                <Store className="size-4" aria-hidden />
              </span>
              <StepHeading
                id="storefront-title"
                step={4}
                title="Default Storefront"
                subtitle="The storefront identity shown before packages are connected."
              />
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

          <div className="border-border bg-card sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 rounded-xl border p-3 shadow-lg">
            <span className="text-muted-foreground hidden text-sm sm:block">
              {handleLabel}
            </span>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full gap-2 sm:w-auto"
              onPointerDown={captureHandle}
            >
              <Save className="size-4" />
              {isSubmitting ? "Saving…" : "Save Public Profile"}
            </Button>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <ProfileCompletionPanel completion={completion} />
          {/* Desktop only. The aside sits beside the editor on large screens, but
              stacks directly beneath it on mobile — where this repeats the cover
              and avatar the Profile Media step is already showing, a few hundred
              pixels further up. */}
          <div className="hidden lg:block">
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
          </div>
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
  withLeagueMark = false,
  ...register
}: {
  value: string;
  label: string;
  withLeagueMark?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        value={value}
        className="peer sr-only"
        {...register}
      />
      <span className="border-border text-muted-foreground peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:text-foreground inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors select-none md:min-h-9">
        {withLeagueMark ? (
          <LeagueMark leagueKey={value} size="sm" className="rounded-md" />
        ) : null}
        {label}
      </span>
    </label>
  );
}
