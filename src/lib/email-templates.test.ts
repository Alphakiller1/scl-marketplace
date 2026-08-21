import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderEmailTemplate } from "@/lib/email-template-render";
import {
  EMAIL_TEMPLATE_SLUGS,
  defaultEmailTemplate,
  isEmailTemplateSlug,
  unknownVariables,
} from "@/lib/email-templates";
import { emailTemplateSchema } from "@/lib/schemas/email-template.schema";

const BASE = {
  slug: "WELCOME" as const,
  subject: "Hello",
  actionLabel: "Go",
  footnote: "",
};

describe("rendering owner-edited copy", () => {
  it("gives the button the URL the sender supplies, not one from the body", () => {
    const { html, text } = renderEmailTemplate({
      body: "Hi.\n\n{{button}}",
      actionLabel: "Verify email",
      actionUrl: "https://scl.test/verify?token=abc",
    });
    assert.ok(html.includes('href="https://scl.test/verify?token=abc"'));
    assert.ok(html.includes("Verify email"));
    assert.ok(
      text.includes("Verify email:\nhttps://scl.test/verify?token=abc"),
    );
  });

  it("treats '# ' as a heading and blank lines as paragraphs", () => {
    const { html, text } = renderEmailTemplate({
      body: "# Big news\n\nFirst para.\n\nSecond para.\n\n{{button}}",
      actionLabel: "Go",
      actionUrl: "https://scl.test/",
    });
    assert.ok(html.includes("<h2"));
    assert.ok(html.includes("Big news"));
    assert.equal(html.match(/<p style="line-height/g)?.length, 2);
    assert.ok(text.startsWith("Big news\n\nFirst para.\n\nSecond para."));
  });

  it("keeps a single newline as a line break inside one paragraph", () => {
    const { html } = renderEmailTemplate({
      body: "Line one\nLine two\n\n{{button}}",
      actionLabel: "Go",
      actionUrl: "https://scl.test/",
    });
    assert.ok(html.includes("Line one<br />Line two"));
  });

  it("escapes what owners type, so copy cannot inject markup", () => {
    const { html } = renderEmailTemplate({
      body: '<script>alert("x")</script>\n\n{{button}}',
      actionLabel: "Go",
      actionUrl: "https://scl.test/",
    });
    assert.ok(!html.includes("<script>"), "raw script tag survived");
    assert.ok(html.includes("&lt;script&gt;"));
  });

  it("drops a block whose only content was an empty variable", () => {
    // The verification email has no handle to show for an account without one;
    // the line must vanish rather than leave a gap where it would have been.
    const { html, text } = renderEmailTemplate({
      body: "# Verify\n\n{{account}}\n\nConfirm your email.\n\n{{button}}",
      actionLabel: "Verify",
      actionUrl: "https://scl.test/",
      variables: { "{{account}}": "" },
    });
    assert.ok(!/<p[^>]*>\s*<\/p>/.test(html), "left an empty paragraph");
    assert.ok(!/\n{3,}/.test(text), "left a blank-line run");
    assert.ok(text.includes("Confirm your email."));
  });

  it("escapes a variable's value exactly once", () => {
    const { html } = renderEmailTemplate({
      body: "{{account}}\n\n{{button}}",
      actionLabel: "Go",
      actionUrl: "https://scl.test/",
      variables: { "{{account}}": "Account: @a<b" },
    });
    assert.ok(html.includes("@a&lt;b"));
    assert.ok(!html.includes("&amp;lt;"), "double-escaped");
  });

  it("appends the footnote as small print, and only when present", () => {
    const withNote = renderEmailTemplate({
      body: "{{button}}",
      actionLabel: "Go",
      actionUrl: "https://scl.test/",
      footnote: "Expires in an hour.",
    });
    assert.ok(withNote.html.includes("Expires in an hour."));
    assert.ok(withNote.text.includes("Expires in an hour."));

    const without = renderEmailTemplate({
      body: "{{button}}",
      actionLabel: "Go",
      actionUrl: "https://scl.test/",
      footnote: "   ",
    });
    assert.ok(!without.html.includes("font-size:13px"));
  });
});

describe("guardrails on saving a template", () => {
  it("refuses a body that would send without its link", () => {
    const result = emailTemplateSchema.safeParse({
      ...BASE,
      body: "Lovely words, no button.",
    });
    assert.equal(result.success, false);
    assert.match(result.error!.issues[0]!.message, /\{\{button\}\}/);
  });

  it("refuses a variable the template cannot fill", () => {
    const result = emailTemplateSchema.safeParse({
      ...BASE,
      body: "Hi {{first_name}}\n\n{{button}}",
    });
    assert.equal(result.success, false);
    assert.match(result.error!.issues[0]!.message, /\{\{first_name\}\}/);
  });

  it("accepts a variable the template does define", () => {
    const result = emailTemplateSchema.safeParse({
      slug: "VERIFICATION",
      subject: "Verify",
      actionLabel: "Verify email",
      footnote: "",
      body: "{{account}}\n\nConfirm.\n\n{{button}}",
    });
    assert.equal(result.success, true);
  });

  it("requires a subject and a button label", () => {
    assert.equal(
      emailTemplateSchema.safeParse({
        ...BASE,
        subject: "",
        body: "{{button}}",
      }).success,
      false,
    );
    assert.equal(
      emailTemplateSchema.safeParse({
        ...BASE,
        actionLabel: "",
        body: "{{button}}",
      }).success,
      false,
    );
  });
});

describe("the template registry", () => {
  it("recognises exactly the slugs it ships", () => {
    for (const slug of EMAIL_TEMPLATE_SLUGS) {
      assert.ok(isEmailTemplateSlug(slug));
      assert.ok(defaultEmailTemplate(slug).body.length > 0);
    }
    assert.equal(isEmailTemplateSlug("NOT_A_TEMPLATE"), false);
  });

  it("ships defaults that would pass their own save guardrails", () => {
    for (const slug of EMAIL_TEMPLATE_SLUGS) {
      const result = emailTemplateSchema.safeParse({
        slug,
        ...defaultEmailTemplate(slug),
      });
      assert.equal(result.success, true, `${slug} default is unsaveable`);
      assert.deepEqual(
        unknownVariables(slug, defaultEmailTemplate(slug).body),
        [],
      );
    }
  });
});
