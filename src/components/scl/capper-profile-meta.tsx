import { bookLabel, bookShort } from "@/lib/books";
import { SportTag, TrophyBadge } from "@/components/scl/badges";
import { formatJoinedDate } from "@/lib/format";
import type { CapperSummary } from "@/lib/mock";
import { cn } from "@/lib/utils";

/**
 * Profile context below Evidence Brief + proof history — bio, coverage, join.
 * Kept off the first viewport so the page reads as a proof record first.
 */
export function CapperProfileMeta({
  capper,
  className,
}: {
  capper: CapperSummary;
  className?: string;
}) {
  const selectedSports = capper.sports?.length ? capper.sports : [];
  const selectedBooks = capper.books?.length ? capper.books : [];
  const hasCoverage =
    selectedSports.length > 0 ||
    selectedBooks.length > 0 ||
    Boolean(capper.specialties?.length);
  const hasSocials =
    capper.socials &&
    Object.values(capper.socials).some((v) => Boolean(v?.trim()));

  if (
    !capper.headline &&
    !capper.bio &&
    !hasCoverage &&
    !capper.joinedAt &&
    !hasSocials &&
    !capper.trophies.length
  ) {
    return null;
  }

  return (
    <section
      className={cn("border-border space-y-4 border-t pt-6", className)}
      aria-label="Capper profile details"
    >
      <h2 className="scl-display text-base font-bold tracking-[0.02em]">
        About
      </h2>

      {capper.headline ? (
        <p className="max-w-2xl text-sm font-semibold sm:text-base">
          {capper.headline}
        </p>
      ) : null}

      {capper.bio ? (
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          {capper.bio}
        </p>
      ) : null}

      {hasCoverage ? (
        <div className="space-y-3">
          {selectedSports.length ? (
            <div>
              <p className="scl-eyebrow mb-1.5 text-[color:var(--scl-muted-label)]">
                Sports
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedSports.map((sport) => (
                  <SportTag key={sport} sport={sport} />
                ))}
              </div>
            </div>
          ) : null}
          {selectedBooks.length ? (
            <div>
              <p className="scl-eyebrow mb-1.5 text-[color:var(--scl-muted-label)]">
                Books
              </p>
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="list"
                aria-label="Sportsbooks"
              >
                {selectedBooks.map((key) => (
                  <span
                    key={key}
                    role="listitem"
                    title={bookLabel(key)}
                    className="scl-data border-border text-muted-foreground inline-flex h-9 items-center justify-center rounded-[18px] border bg-[color:var(--scl-ink-800)] px-3 text-[11px] font-medium tracking-[0.08em] uppercase"
                  >
                    {bookShort(key)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {capper.specialties?.length ? (
            <div>
              <p className="scl-eyebrow mb-1.5 text-[color:var(--scl-muted-label)]">
                Specialties
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {capper.specialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="border-border bg-surface-2 text-muted-foreground rounded-lg border px-2 py-1 text-xs font-medium"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {capper.joinedAt ? (
          <span>Joined {formatJoinedDate(capper.joinedAt)}</span>
        ) : null}
        {hasSocials && capper.socials ? (
          <>
            {capper.joinedAt ? (
              <span className="border-border h-4 border-l" aria-hidden />
            ) : null}
            <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
              {capper.socials.twitter ? (
                <span className="tabular-nums">@{capper.socials.twitter}</span>
              ) : null}
              {capper.socials.instagram ? (
                <span className="tabular-nums">
                  ig/{capper.socials.instagram}
                </span>
              ) : null}
              {capper.socials.website ? (
                <span className="break-all">{capper.socials.website}</span>
              ) : null}
            </span>
          </>
        ) : null}
      </div>

      {capper.trophies.length ? (
        <div className="flex flex-wrap gap-2">
          {capper.trophies.map((trophy) => (
            <TrophyBadge key={trophy} label={trophy} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
