import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  altTextFromFileName,
  buildEmailImageId,
  collectEmailImageIds,
  EMAIL_IMAGE_ALT_MAX_LENGTH,
  EMAIL_IMAGE_MAX_DISPLAY_WIDTH,
  emailImageDisplayWidth,
  emailImageIntrinsicWidth,
  emailImageObjectPath,
  formatEmailImageToken,
  insertEmailImageToken,
  isEmailImageId,
  parseEmailBodyBlocks,
  removeEmailImageToken,
  renderEmailBodyHtml,
  replaceEmailImageToken,
  sanitizeEmailImageAlt,
} from "@/lib/email-image";

const HANDLE = "9f2c7a41b8e0d3f1";
const WIDE = `${HANDLE}-1120`;
const NARROW = `${HANDLE}-300`;

const urlFor = (id: string) =>
  `https://cdn.test/scl-email-media/broadcasts/${id}.jpg`;

describe("email image ids", () => {
  it("accepts an id this module minted", () => {
    assert.equal(isEmailImageId(buildEmailImageId(HANDLE, 1120)), true);
  });

  it("rounds a fractional width into the handle", () => {
    assert.equal(buildEmailImageId(HANDLE, 899.6), `${HANDLE}-900`);
  });

  it("refuses to mint an id the renderer could not use", () => {
    assert.throws(() => buildEmailImageId("NOT-HEX", 1120));
    assert.throws(() => buildEmailImageId(HANDLE, 0));
  });

  it("rejects anything it did not mint", () => {
    for (const id of [
      "",
      HANDLE,
      "../../secrets-1120",
      `${HANDLE}-1120.jpg`,
      "9F2C7A41B8E0D3F1-1120",
      `${HANDLE}-99999`,
    ]) {
      assert.equal(isEmailImageId(id), false, id);
    }
  });

  // A bucket key built from unvalidated text is how `../` escapes a prefix.
  it("only builds a storage path for a minted id", () => {
    assert.equal(emailImageObjectPath(WIDE), `broadcasts/${WIDE}.jpg`);
    assert.equal(emailImageObjectPath("../../etc/passwd"), null);
    assert.equal(emailImageObjectPath("a/b-100"), null);
  });
});

describe("display width", () => {
  it("caps a wide image at the email content width", () => {
    assert.equal(emailImageIntrinsicWidth(WIDE), 1120);
    assert.equal(emailImageDisplayWidth(WIDE), EMAIL_IMAGE_MAX_DISPLAY_WIDTH);
  });

  // The reason the width rides inside the handle at all: a 300px logo stretched
  // across a 560px email is the ugliest way this feature can fail.
  it("never enlarges a narrow image", () => {
    assert.equal(emailImageDisplayWidth(NARROW), 300);
  });

  it("has no width for a foreign id", () => {
    assert.equal(emailImageDisplayWidth("nope"), null);
  });
});

describe("alt text", () => {
  it("keeps the token grammar intact", () => {
    assert.equal(
      sanitizeEmailImageAlt("Week 1 | slate [board]"),
      "Week 1 slate board",
    );
    assert.equal(sanitizeEmailImageAlt("line\none\ttwo"), "line one two");
  });

  it("truncates to a description", () => {
    const long = "a".repeat(400);
    assert.equal(
      sanitizeEmailImageAlt(long).length,
      EMAIL_IMAGE_ALT_MAX_LENGTH,
    );
  });

  it("drafts alt text from a filename", () => {
    assert.equal(altTextFromFileName("week-1_slate.PNG"), "week 1 slate");
    assert.equal(
      altTextFromFileName("Screenshot 2026-09-08.jpeg"),
      "Screenshot 2026 09 08",
    );
  });

  it("omits the separator when there is nothing to describe", () => {
    assert.equal(formatEmailImageToken(WIDE, "  "), `[image:${WIDE}]`);
    assert.equal(formatEmailImageToken(WIDE, "Slate"), `[image:${WIDE}|Slate]`);
  });
});

describe("parseEmailBodyBlocks", () => {
  it("keeps the image between the paragraphs it was dropped between", () => {
    const blocks = parseEmailBodyBlocks(
      `Big week ahead.\n\n[image:${WIDE}|Slate]\n\nLock it in.`,
    );
    assert.deepEqual(
      blocks.map((b) => b.kind),
      ["text", "image", "text"],
    );
    assert.equal(blocks[1]!.kind === "image" && blocks[1]!.alt, "Slate");
  });

  it("treats a single newline as a line break, a blank line as a paragraph", () => {
    const blocks = parseEmailBodyBlocks("one\ntwo\n\nthree");
    assert.deepEqual(blocks, [
      { kind: "text", text: "one\ntwo" },
      { kind: "text", text: "three" },
    ]);
  });

  it("promotes a token typed mid-sentence to its own block", () => {
    const blocks = parseEmailBodyBlocks(`before [image:${WIDE}] after`);
    assert.deepEqual(
      blocks.map((b) => b.kind),
      ["text", "image", "text"],
    );
  });

  // Shipping the literal text `[image:oops]` to the whole roster is worse than
  // shipping no picture, so an unknown handle is consumed and dropped.
  it("drops a token it cannot resolve without leaking it as text", () => {
    const blocks = parseEmailBodyBlocks("keep [image:oops|Slate] this");
    assert.deepEqual(blocks, [
      { kind: "text", text: "keep" },
      { kind: "text", text: "this" },
    ]);
  });

  it("is not affected by regex state from a previous call", () => {
    const body = `[image:${WIDE}]`;
    assert.equal(parseEmailBodyBlocks(body).length, 1);
    assert.equal(parseEmailBodyBlocks(body).length, 1);
    assert.equal(parseEmailBodyBlocks(body).length, 1);
  });

  it("collects each image once, in order", () => {
    assert.deepEqual(
      collectEmailImageIds(
        `[image:${WIDE}] a [image:${NARROW}] b [image:${WIDE}]`,
      ),
      [WIDE, NARROW],
    );
    assert.deepEqual(collectEmailImageIds("no pictures here"), []);
  });
});

describe("renderEmailBodyHtml", () => {
  it("renders the image at its display width, for Outlook and for phones", () => {
    const html = renderEmailBodyHtml(`[image:${NARROW}|Logo]`, urlFor);
    assert.match(html, /width="300"/);
    assert.match(html, /max-width:300px/);
    assert.match(html, /display:block/);
    assert.match(html, /alt="Logo"/);
    assert.match(html, new RegExp(`src="${urlFor(NARROW)}"`));
  });

  it("escapes the text around it", () => {
    const html = renderEmailBodyHtml("<script>alert(1)</script>", urlFor);
    assert.equal(html.includes("<script>"), false);
    assert.match(html, /&lt;script&gt;/);
  });

  // The src never comes from the message, so this is belt and braces — but an
  // attribute break in a mail that reaches 136 inboxes is worth two checks.
  it("escapes a quote in a resolved URL and in alt text", () => {
    const html = renderEmailBodyHtml(
      `[image:${WIDE}|say "hi" & bye]`,
      () => 'https://cdn.test/a.jpg" onerror="alert(1)',
    );
    assert.equal(html.includes('" onerror="'), false);
    assert.match(html, /&quot;hi&quot; &amp; bye/);
  });

  it("drops an image whose URL cannot be resolved", () => {
    const html = renderEmailBodyHtml(`Hi\n\n[image:${WIDE}]`, () => null);
    assert.equal(html.includes("<img"), false);
    assert.match(html, /<p style="line-height:1.6">Hi<\/p>/);
  });

  it("turns a single newline into a break", () => {
    assert.match(renderEmailBodyHtml("one\ntwo", urlFor), /one<br \/>two/);
  });
});

describe("insertEmailImageToken", () => {
  const token = `[image:${WIDE}|Slate]`;

  it("inserts into an empty message without leading blank lines", () => {
    const out = insertEmailImageToken("", 0, 0, token);
    assert.equal(out.text, token);
    assert.equal(out.caret, token.length);
  });

  it("separates the token from the text around the cursor", () => {
    const out = insertEmailImageToken("before after", 7, 7, token);
    assert.equal(out.text, `before\n\n${token}\n\nafter`);
    assert.equal(out.text.slice(out.caret), "after");
  });

  it("does not stack blank lines that are already there", () => {
    const out = insertEmailImageToken("before\n\n", 8, 8, token);
    assert.equal(out.text, `before\n\n${token}`);
  });

  it("completes a single newline into a paragraph break", () => {
    const out = insertEmailImageToken("before\n", 7, 7, token);
    assert.equal(out.text, `before\n\n${token}`);
  });

  it("replaces the selection", () => {
    const out = insertEmailImageToken("keep DROP keep", 5, 9, token);
    assert.equal(out.text, `keep\n\n${token}\n\nkeep`);
  });

  it("clamps a cursor outside the text", () => {
    const out = insertEmailImageToken("abc", 99, 99, token);
    assert.equal(out.text, `abc\n\n${token}`);
  });
});

describe("replaceEmailImageToken", () => {
  it("rewrites the description an owner edited", () => {
    assert.equal(
      replaceEmailImageToken(`a\n\n[image:${WIDE}|Old]\n\nb`, WIDE, "New alt"),
      `a\n\n[image:${WIDE}|New alt]\n\nb`,
    );
  });

  it("adds a description to a token that had none", () => {
    assert.equal(
      replaceEmailImageToken(`[image:${WIDE}]`, WIDE, "Slate"),
      `[image:${WIDE}|Slate]`,
    );
  });

  it("sanitizes as it writes, so the token cannot be broken open", () => {
    assert.equal(
      replaceEmailImageToken(`[image:${WIDE}]`, WIDE, "a] and [b|c"),
      `[image:${WIDE}|a and bc]`,
    );
  });

  it("leaves other images alone", () => {
    assert.equal(
      replaceEmailImageToken(
        `[image:${WIDE}]\n\n[image:${NARROW}|Keep]`,
        WIDE,
        "Set",
      ),
      `[image:${WIDE}|Set]\n\n[image:${NARROW}|Keep]`,
    );
  });

  // `String.replace` reads these as substitution patterns when the replacement
  // is a string, which would mangle a perfectly ordinary price in a description.
  it("writes a dollar sign literally", () => {
    assert.equal(
      replaceEmailImageToken(`[image:${WIDE}]`, WIDE, "$5 off $& more $' $`"),
      `[image:${WIDE}|$5 off $& more $' $\`]`,
    );
  });
});

describe("removeEmailImageToken", () => {
  it("removes the token and the gap it leaves", () => {
    assert.equal(
      removeEmailImageToken(`one\n\n[image:${WIDE}|Slate]\n\ntwo`, WIDE),
      "one\n\ntwo",
    );
  });

  it("removes every reference to the same image", () => {
    assert.equal(
      removeEmailImageToken(
        `[image:${WIDE}]\n\nx\n\n[image:${WIDE}|Two]`,
        WIDE,
      ),
      "x",
    );
  });

  it("leaves other images alone", () => {
    const out = removeEmailImageToken(
      `[image:${WIDE}]\n\n[image:${NARROW}|Keep]`,
      WIDE,
    );
    assert.equal(out, `[image:${NARROW}|Keep]`);
  });
});
