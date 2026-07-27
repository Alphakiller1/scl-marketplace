export function PolicyText({ body }: { body: string }) {
  const paragraphs = body
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.map((paragraph, index) => (
    <p
      key={`${index}-${paragraph.slice(0, 24)}`}
      className="whitespace-pre-line"
    >
      {paragraph}
    </p>
  ));
}
