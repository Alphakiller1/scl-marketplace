/**
 * Turn owner-edited template text into the two parts a message is sent as.
 *
 * The body is plain text, so it is escaped on the way out and owners cannot
 * paste markup that breaks the layout — the only structure they get is the one
 * documented in the editor: `# ` for a heading, a blank line for a paragraph,
 * and `{{button}}` for the call to action.
 *
 * The plain-text part is built from the same source as the HTML rather than
 * maintained beside it. Sending HTML alone scores worse with the filters that
 * decide inbox versus promotions, and a text part that has drifted from the
 * HTML is worse than none.
 */

import { escapeHtml } from "@/lib/email-escape";

export type RenderedEmail = { html: string; text: string };

const BRAND = "#5b4bdb";

function buttonHtml(label: string, url: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`;
}

/**
 * Substitute the template's own variables. Values are inserted before escaping
 * so a value containing `<` is escaped once, by the block renderer below, and
 * never double-escaped into `&amp;lt;`.
 */
function applyVariables(
  body: string,
  variables: Record<string, string | null | undefined>,
): string {
  let out = body;
  for (const [token, value] of Object.entries(variables)) {
    out = out.split(token).join(value ?? "");
  }
  return out;
}

export function renderEmailTemplate(input: {
  body: string;
  actionLabel: string;
  actionUrl: string;
  footnote?: string;
  /** Keyed by full token, e.g. `{"{{account}}": "@sharpcapper"}`. */
  variables?: Record<string, string | null | undefined>;
  /** Appended below the footnote — the announcements opt-out, where one applies. */
  footerHtml?: string;
  footerText?: string;
}): RenderedEmail {
  const resolved = applyVariables(input.body, input.variables ?? {});

  const htmlBlocks: string[] = [];
  const textBlocks: string[] = [];

  for (const raw of resolved.split(/\n{2,}/)) {
    const block = raw.trim();
    // A variable that resolved to nothing (no handle on the account) leaves an
    // empty block behind; dropping it here is what keeps the gap from showing.
    if (!block) continue;

    if (block === "{{button}}") {
      htmlBlocks.push(buttonHtml(input.actionLabel, input.actionUrl));
      textBlocks.push(`${input.actionLabel}:\n${input.actionUrl}`);
      continue;
    }

    if (block.startsWith("# ")) {
      const heading = block.slice(2).trim();
      htmlBlocks.push(
        `<h2 style="font-size:18px;margin:28px 0 10px">${escapeHtml(heading)}</h2>`,
      );
      textBlocks.push(heading);
      continue;
    }

    // A single newline inside a block is a line break, not a new paragraph.
    const lines = block.split("\n").map((line) => escapeHtml(line.trim()));
    htmlBlocks.push(
      `<p style="line-height:1.6;margin:0 0 12px">${lines.join("<br />")}</p>`,
    );
    textBlocks.push(block);
  }

  if (input.footnote?.trim()) {
    htmlBlocks.push(
      `<p style="color:#666;font-size:13px;margin:20px 0 0">${escapeHtml(input.footnote.trim())}</p>`,
    );
    textBlocks.push(input.footnote.trim());
  }

  if (input.footerHtml) htmlBlocks.push(input.footerHtml);
  if (input.footerText) textBlocks.push(input.footerText);

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#111">
      ${htmlBlocks.join("\n      ")}
    </div>
  `;

  return { html, text: textBlocks.join("\n\n") };
}
