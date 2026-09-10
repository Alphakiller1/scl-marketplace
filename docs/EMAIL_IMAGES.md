# Images in owner emails

Owners can drop pictures into **every email they can write**:

- **Admin → Mass Email** (`/admin/messages`) — the one-off blast.
- **Admin → Capper Emails** (`/admin/emails`) — the automated lifecycle
  templates (welcome, verification, password reset, follow-ups).

Both mount the same control, `EmailBodyField`, so "add an image" looks and
behaves identically in either place.

## Using it

Four ways to add an image, all equivalent:

- **Add image** — opens a file picker.
- **Drag** a file onto the message box.
- **Paste** a screenshot from the clipboard.
- **Paste a picture copied from a web page**, a doc, or Canva — those put no file
  on the clipboard at all, only HTML with a remote `<img src>`, so SCL fetches it
  for you.

If a paste carries something we cannot use, it now says so. Silently doing
nothing is what the first version did, and it read as "paste is broken".

The picture is inserted at the cursor, as its own block, and shows up in the
message as a marker:

```
Big week ahead.

[image:9f2c7a41b8e0d3f1-1120|Week 1 slate]

Lock it in before first pitch.
```

That marker is ordinary text. Move it, cut it, or delete it to move, copy or
remove the image — the **Preview** panel below the box redraws as you type, and
it lays the message out with the same code that renders the mail that is sent.

Each image gets a **Describe this image** field. Gmail and Outlook block images
by default for senders a reader has not written to before, so for a good number
of recipients that description is all they see. It is pre-filled from the
filename; a better one is worth the ten seconds.

In an automated template the picture also gets a plain-text stand-in —
`[Image: Week 1 slate]` — because those emails send a text part alongside the
HTML, and a reader on the text part should know something was there.

Limits: **6 images per email**, **5 MB per file** (10 MB for a fetched link),
JPG / PNG / WebP / HEIC in.

## What happens to a file

1. Rotated upright from its EXIF orientation, resized to at most 1120px wide
   (never enlarged), flattened onto white, and encoded as **JPEG**.
   - JPEG rather than WebP because Outlook 2016-2019 and Windows Mail render a
     WebP as a broken image.
   - Flattened rather than transparent because a mail client in dark mode paints
     its own background behind a transparent PNG, and black logo text on it
     disappears.
2. Uploaded to the public Supabase bucket named by `SUPABASE_EMAIL_MEDIA_BUCKET`
   (default `scl-email-media`), under `broadcasts/<handle>.jpg`. The bucket is
   created automatically on the first upload.
3. The marker's handle carries the stored width, so the mail can size the image
   truthfully — Outlook's Word engine ignores `max-width`, and without a real
   `width` a 300px logo would be stretched across the 560px email.

Every upload mints a fresh random handle and nothing is ever overwritten. An
email already in someone's inbox re-fetches its pictures every time it is opened,
so replacing an object in place would silently rewrite mail sent weeks ago. For
the same reason, images are never deleted from the bucket: removing one from a
draft only removes the marker.

## Fetching a pasted link

A pasted web image means the server opens a URL the user chose, which is the
shape of an SSRF. `src/lib/remote-image-fetch.ts` carries the guards: http(s)
only, hostnames resolved with every returned address checked against the private
ranges, each redirect hop re-validated by hand, a content-type check, a 10 MB
ceiling and a 10s timeout. The range table is unit-tested in
`remote-image-fetch.test.ts` — including `169.254.169.254`. The action is
admin-only on top of all that.

## Before a send goes out

A mass email cannot be recalled, so `sendBroadcastAction` refuses the send if:

- more than 6 images are referenced, or
- image hosting is not configured, or
- any referenced image does not answer a public `HEAD` request.

That last check is made against the same public URL a recipient's mail client
will fetch, which is the only way to catch a bucket that has quietly stopped
being public before the mail is in 136 inboxes rather than after.

`saveEmailTemplateAction` runs the same check, and for a stronger reason: an
automated template is not a one-off, so a picture that 404s would break every
future send of that email until somebody noticed.

A marker whose handle is not recognised is dropped from the rendered mail rather
than sent as literal `[image:...]` text.

## Configuration

```
SUPABASE_URL="https://PROJECT_REF.supabase.co"
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_EMAIL_MEDIA_BUCKET="scl-email-media"
```

Both credentials must name the same Supabase project; a mismatched pair fails as
`Invalid JWT` / `Bucket not found` and the upload error says so explicitly.

## Verifying it end to end

```bash
npm run verify:email-images
```

Uploads a generated graphic through the production code path, fetches it back
from its public URL the way an inbox would, and renders the mail that would be
sent. Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment. It
leaves one small probe object in the bucket and prints its path.

## Code map

| File                                                 | Role                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/email-image.ts`                             | Marker grammar, parsing, HTML rendering. Pure; the mailer and the composer preview share it.                                        |
| `src/lib/email-image-process.ts`                     | Sharp pipeline (rotate, resize, flatten, JPEG).                                                                                     |
| `src/lib/email-image-url.ts`                         | Handle → public URL, and the pre-send reachability gate. No secret needed, which is why automated templates can resolve images too. |
| `src/lib/email-image-client.ts`                      | Getting a file out of a paste or a drop, whichever way the browser supplied it.                                                     |
| `src/lib/remote-image-fetch.ts`                      | Fetching a pasted web image, with the SSRF guards.                                                                                  |
| `src/lib/actions/email-image.action.ts`              | Admin-only upload.                                                                                                                  |
| `src/components/scl/email-body-field.tsx`            | The shared message box: insert at cursor, drag, paste, tray, preview. Used by both surfaces.                                        |
| `src/components/scl/broadcast-composer.tsx`          | Mass email: audience, subject, send gate.                                                                                           |
| `src/components/scl/admin-email-template-editor.tsx` | Automated templates.                                                                                                                |
| `src/components/scl/email-image-tray.tsx`            | Uploaded images, alt text, remove/place.                                                                                            |
| `src/components/scl/email-body-preview.tsx`          | The message as an inbox lays it out.                                                                                                |
