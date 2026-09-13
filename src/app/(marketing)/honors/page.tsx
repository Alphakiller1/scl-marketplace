import { HonorsSpotlight } from "@/components/scl/honors-spotlight";
import { getCurrentHonors } from "@/lib/queries/honors";
import { getHonorsContent } from "@/lib/queries/honors-content";

export const metadata = {
  title: "SCL Honors",
  description: "SCL award winners, qualification rules, and criteria.",
};
export default async function HonorsPage() {
  const [awards, content] = await Promise.all([
    getCurrentHonors(),
    getHonorsContent(),
  ]);
  return (
    <main className="mx-auto max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <p className="scl-eyebrow">Verified achievement</p>
        <h1 className="scl-page-title">{content.title}</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed whitespace-pre-line sm:text-base">
          {content.body}
        </p>
      </header>
      <HonorsSpotlight awards={awards} />
    </main>
  );
}
