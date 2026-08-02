import { Compass } from "lucide-react";

export function DiscoverOverview() {
  return (
    <header className="scl-section-mark pt-3 sm:pt-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="scl-eyebrow flex items-center gap-2 text-[color:var(--scl-muted-data)]">
            <Compass
              className="size-3.5 text-[color:var(--scl-blue)]"
              aria-hidden
            />
            Public Evidence Directory
          </div>
          <h1 className="scl-page-title mt-1.5">Discover</h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-snug sm:text-[0.95rem]">
            Explore cappers through evidence-based views of record,
            verification, specialization, and pricing.
          </p>
        </div>
      </div>
    </header>
  );
}
