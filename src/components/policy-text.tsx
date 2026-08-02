const NUMBERED_HEADING = /^\d+\.\s+\S/;
const BULLET_LINE = /^-\s+/;
const LINKABLE_TEXT =
  /(https:\/\/[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
const POLICY_HEADINGS = new Set([
  "TERMS OF SERVICE",
  "Definitions",
  "Creator Representations and Responsibilities",
  "Ownership of Creator Content",
  "Creator Profiles and Recognition",
  "Suspension of Creator Features",
  "Responsible Gaming",
  "Age Restrictions",
  "Know the Risks",
  "Set Personal Limits",
  "Sports Cappers Leaderboard's Role",
  "Support and Resources",
  "Contact Us",
  "Purchases Through Third-Party Platforms",
  "Purchases Made Directly Through SCL",
  "Questions",
  "A. Information You Provide",
  "B. Information Collected Automatically",
  "C. Information from Third Parties",
  "D. Cookies",
  "E. Information We Do Not Collect",
  "A. Service Providers",
  "B. Third-Party Platform Providers",
  "C. Public Information",
  "D. Legal Compliance and Protection",
  "E. Corporate Affiliates",
  "F. Business Transactions",
  "G. With Your Consent",
]);

function isHeading(block: string) {
  return NUMBERED_HEADING.test(block) || POLICY_HEADINGS.has(block);
}

export function PolicyText({ body }: { body: string }) {
  const blocks = body
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim());
    if (lines.every((line) => BULLET_LINE.test(line))) {
      return (
        <ul
          key={`${index}-${block.slice(0, 24)}`}
          className="marker:text-foreground list-disc space-y-2 pl-6"
        >
          {lines.map((line) => (
            <li key={line}>{renderInline(line.replace(BULLET_LINE, ""))}</li>
          ))}
        </ul>
      );
    }

    if (isHeading(block)) {
      return (
        <h2
          key={`${index}-${block.slice(0, 24)}`}
          className="text-foreground pt-4 text-lg font-semibold tracking-tight first:pt-0"
        >
          {block}
        </h2>
      );
    }

    return (
      <p key={`${index}-${block.slice(0, 24)}`} className="whitespace-pre-line">
        {renderInline(block)}
      </p>
    );
  });
}

function renderInline(text: string) {
  return text.split(LINKABLE_TEXT).map((part, index) => {
    if (/^https:\/\//i.test(part)) {
      const href = part.endsWith(".") ? part.slice(0, -1) : part;
      const suffix = part.endsWith(".") ? "." : "";
      return (
        <span key={`${index}-${part}`}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="scl-link break-words"
          >
            {href}
          </a>
          {suffix}
        </span>
      );
    }
    if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) {
      return (
        <a
          key={`${index}-${part}`}
          href={`mailto:${part}`}
          className="scl-link"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
