import { HonorsSpotlight } from "@/components/scl/honors-spotlight";
import { HonorCard } from "@/components/scl/honor-card";
import { AWARD_PERIODS, honorsRules } from "@/lib/honors";
import { getAllHonors, getFeaturedHonors } from "@/lib/queries/honors";
import { getHonorsContent } from "@/lib/queries/honors-content";

export const metadata = {
  title: "SCL Honors",
  description: "SCL award winners, qualification rules, and criteria.",
};
export const revalidate = 300;

export default async function HonorsPage() {
  const [featured, all, content] = await Promise.all([
    getFeaturedHonors(),
    getAllHonors(),
    getHonorsContent(),
  ]);
  const featuredIds = new Set(
    [...featured.annual, ...featured.season, ...featured.monthly].map(
      (award) => award.id,
    ),
  );
  const past = all.filter((award) => !featuredIds.has(award.id));
  return (
    <main className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <p className="scl-eyebrow">Verified achievement</p>
        <h1 className="scl-page-title">{content.title}</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed whitespace-pre-line sm:text-base">
          {content.body}
        </p>
      </header>
      <HonorsSpotlight featured={featured} />
      <section aria-labelledby="honors-rules-title" className="max-w-3xl">
        <h2 id="honors-rules-title" className="scl-display text-xl font-bold">
          Rules and criteria
        </h2>
        <div className="mt-3 space-y-5">
          {honorsRules().map((group) => (
            <div key={group.heading}>
              <h3 className="text-sm font-semibold">{group.heading}</h3>
              <ul className="text-muted-foreground mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {group.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      {past.length ? (
        <section aria-labelledby="honors-past-title" className="space-y-4">
          <h2 id="honors-past-title" className="scl-display text-xl font-bold">
            Past winners
          </h2>
          {AWARD_PERIODS.map(({ key, label }) => {
            const awards = past.filter((award) => award.period === key);
            if (!awards.length) return null;
            return (
              <div key={key} className="space-y-2">
                <h3 className="scl-eyebrow text-foreground">{label}</h3>
                <ul className="flex flex-wrap gap-2">
                  {awards.map((award) => (
                    <li key={award.id} className="w-full min-w-0 sm:w-auto">
                      <HonorCard award={award} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
