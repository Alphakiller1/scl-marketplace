"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Save, Send, Trash2, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";

import {
  AudienceFilterControls,
  audienceSelectClassName,
} from "@/components/scl/audience-filter-controls";
import { EmailBodyField } from "@/components/scl/email-body-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteAudienceGroupAction,
  previewBroadcastAudienceAction,
  saveAudienceGroupAction,
  sendBroadcastAction,
} from "@/lib/actions/broadcast.action";
import { audienceLabel } from "@/lib/admin-audience";
import {
  emptyAudienceFilters,
  type AudienceFilters,
} from "@/lib/schemas/audience.schema";
import type { BroadcastInput } from "@/lib/schemas/broadcast.schema";

type Audience = BroadcastInput["audience"];
type PreviewMember = {
  id: string;
  label: string;
  email: string;
  lastPlayAt: string | null;
  playCount: number;
  hasConnectedStorefront: boolean;
};

type SavedGroup = {
  id: string;
  name: string;
  description: string | null;
  filters: AudienceFilters;
};

type Preview = { count: number; fingerprint: string; members: PreviewMember[] };

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  {
    value: "FILTERED_CAPPERS",
    label: "Build an audience",
    hint: "Combine activity, account, verification, and storefront filters.",
  },
  {
    value: "ALL_CAPPERS",
    label: "All eligible cappers",
    hint: "Every reachable capper, minus opt-outs and restricted accounts.",
  },
  {
    value: "VERIFIED_CAPPERS",
    label: "Verified only",
    hint: "Cappers who have confirmed their email.",
  },
  {
    value: "SINGLE_CAPPER",
    label: "One capper",
    hint: "A direct operational message about one account.",
  },
];

function newRequestKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** `datetime-local` value for a Date, in the browser's own time zone. */
function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function BroadcastComposer({
  cappers,
  imageBaseUrl,
  savedGroups,
  initialFilters,
}: {
  cappers: { id: string; label: string }[];
  imageBaseUrl: string | null;
  savedGroups: SavedGroup[];
  initialFilters?: AudienceFilters;
}) {
  const router = useRouter();
  const [audience, setAudience] = useState<Audience>(
    initialFilters ? "FILTERED_CAPPERS" : "ALL_CAPPERS",
  );
  const [filters, setFilters] = useState<AudienceFilters>(
    initialFilters ?? emptyAudienceFilters(),
  );
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [userId, setUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(Boolean(initialFilters));
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(newRequestKey);
  const previewRequestId = useRef(0);
  // The dashboard link seeds the first preview only. The server re-renders
  // this page after every save or send, handing back a fresh object; re-running
  // on that would overwrite the audience the admin has since edited.
  const initialFiltersRef = useRef(initialFilters);

  const isMass = audience !== "SINGLE_CAPPER";

  async function runPreview(
    nextAudience: Audience,
    nextFilters: AudienceFilters,
    nextUserId: string,
  ) {
    const requestId = ++previewRequestId.current;
    setPreviewing(true);
    try {
      const result = await previewBroadcastAudienceAction({
        audience: nextAudience,
        userId: nextUserId || undefined,
        filters: nextAudience !== "SINGLE_CAPPER" ? nextFilters : undefined,
      });
      if (requestId !== previewRequestId.current) return;
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setPreview({
        count: result.count,
        fingerprint: result.fingerprint,
        members: result.members,
      });
    } catch {
      if (requestId === previewRequestId.current) {
        toast.error("Couldn't check the recipient list. Try again.");
      }
    } finally {
      if (requestId === previewRequestId.current) setPreviewing(false);
    }
  }

  useEffect(() => {
    const seed = initialFiltersRef.current;
    if (!seed) return;
    void runPreview("FILTERED_CAPPERS", seed, "");
    // Mount-only by design; see initialFiltersRef.
  }, []);

  function updateFilters(patch: Partial<AudienceFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setSelectedGroupId("");
    setPreview(null);
    setDuplicateWarning(null);
    void runPreview(audience, next, userId);
  }

  function chooseAudience(next: Audience) {
    setAudience(next);
    if (next !== "FILTERED_CAPPERS") setSelectedGroupId("");
    // Removals belong to the list they were made on.
    const cleared = { ...filters, excludeUserIds: [] };
    setFilters(cleared);
    setPreview(null);
    setDuplicateWarning(null);
    if (next !== "SINGLE_CAPPER") void runPreview(next, cleared, userId);
  }

  function chooseSavedGroup(groupId: string) {
    setSelectedGroupId(groupId);
    const group = savedGroups.find((item) => item.id === groupId);
    if (!group) return;
    setFilters(group.filters);
    setGroupName(group.name);
    setPreview(null);
    void runPreview("FILTERED_CAPPERS", group.filters, userId);
  }

  function removeMember(member: PreviewMember) {
    const next = {
      ...filters,
      excludeUserIds: [...new Set([...filters.excludeUserIds, member.id])],
    };
    setFilters(next);
    setPreview((current) =>
      current
        ? {
            ...current,
            members: current.members.filter((item) => item.id !== member.id),
          }
        : current,
    );
    // Re-resolve on the server: removing one account can change who else is
    // reached (shared inboxes), and the send must confirm the exact set.
    void runPreview(audience, next, userId);
  }

  function restoreRemoved() {
    const next = { ...filters, excludeUserIds: [] };
    setFilters(next);
    void runPreview(audience, next, userId);
  }

  async function saveGroup() {
    const result = await saveAudienceGroupAction({
      name: groupName,
      filters,
      description: audienceLabel(filters),
    });
    if (!result.ok) return toast.error(result.error);
    setSelectedGroupId(result.group.id);
    router.refresh();
    toast.success(`Saved “${result.group.name}”.`);
  }

  async function deleteGroup() {
    const group = savedGroups.find((item) => item.id === selectedGroupId);
    if (!group) return;
    await deleteAudienceGroupAction(group.id);
    setSelectedGroupId("");
    router.refresh();
    toast.success(`Deleted “${group.name}”.`);
  }

  async function send(confirmDuplicate = false) {
    setSending(true);
    try {
      const result = await sendBroadcastAction({
        audience,
        userId: userId || undefined,
        filters: isMass ? filters : undefined,
        groupId:
          audience === "FILTERED_CAPPERS"
            ? selectedGroupId || undefined
            : undefined,
        subject,
        body,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        confirmRecipientCount: isMass ? preview?.count : undefined,
        confirmFingerprint: isMass ? preview?.fingerprint : undefined,
        requestKey,
        confirmDuplicate,
      });
      if (!result.ok) {
        if (result.code === "DUPLICATE") {
          setDuplicateWarning(result.error);
          return;
        }
        toast.error(result.error);
        if (result.code === "AUDIENCE_CHANGED") {
          void runPreview(audience, filters, userId);
        }
        return;
      }
      toast.success(
        result.scheduledAt
          ? `Campaign scheduled for ${result.recipientCount} recipients on ${new Date(result.scheduledAt).toLocaleString()}.`
          : `Campaign queued for ${result.recipientCount} recipients.`,
      );
      setSubject("");
      setBody("");
      setScheduledAt("");
      setDuplicateWarning(null);
      setRequestKey(newRequestKey());
    } catch {
      // The request key is kept, so trying again cannot create a second
      // campaign if the first attempt actually landed.
      toast.error("Couldn't queue the email. Try again.");
    } finally {
      setSending(false);
    }
  }

  const ready =
    subject.trim().length >= 3 &&
    body.trim().length >= 10 &&
    uploading === 0 &&
    !previewing &&
    (!isMass || (preview !== null && preview.count > 0)) &&
    (audience !== "SINGLE_CAPPER" || Boolean(userId));
  const count = preview?.count ?? null;
  const selectedGroup = savedGroups.find((item) => item.id === selectedGroupId);
  const nameTaken = savedGroups.some(
    (group) => group.name === groupName.trim(),
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)]">
      <Card className="space-y-5 p-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Audience</legend>
          <div className="flex flex-wrap gap-2">
            {AUDIENCES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => chooseAudience(item.value)}
                aria-pressed={audience === item.value}
                className={`focus-visible:ring-ring min-h-10 rounded-xl border px-3 text-sm transition-colors outline-none focus-visible:ring-2 ${
                  audience === item.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface-2 text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {AUDIENCES.find((item) => item.value === audience)?.hint}
          </p>
        </fieldset>

        {audience === "FILTERED_CAPPERS" ? (
          <div className="border-border bg-surface-2 space-y-4 rounded-xl border p-4">
            <AudienceFilterControls
              filters={filters}
              onChange={updateFilters}
            />

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-muted-foreground text-xs font-semibold uppercase">
                    Saved groups
                  </span>
                  <select
                    value={selectedGroupId}
                    onChange={(event) => chooseSavedGroup(event.target.value)}
                    className={audienceSelectClassName}
                  >
                    <option value="">Custom filters</option>
                    {savedGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-muted-foreground text-xs font-semibold uppercase">
                    Group name
                  </span>
                  <Input
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    placeholder="Plays but no storefront"
                    maxLength={80}
                  />
                </label>
              </div>
              <div className="flex gap-2 self-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={groupName.trim().length < 2}
                  onClick={() => void saveGroup()}
                >
                  <Save className="size-4" aria-hidden />
                  {nameTaken ? "Update group" : "Save group"}
                </Button>
                {selectedGroup ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete saved group ${selectedGroup.name}`}
                    onClick={() => void deleteGroup()}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>
            {nameTaken ? (
              <p className="text-muted-foreground text-xs">
                A group named &ldquo;{groupName.trim()}&rdquo; exists. Saving
                replaces its filters.
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              Current audience: {audienceLabel(filters)}
            </p>
          </div>
        ) : null}

        {isMass && filters.excludeUserIds.length ? (
          <p className="text-muted-foreground text-xs">
            {filters.excludeUserIds.length} manually removed ·{" "}
            <button
              type="button"
              onClick={restoreRemoved}
              className="hover:text-foreground underline underline-offset-2"
            >
              Restore all
            </button>
          </p>
        ) : null}

        {audience === "SINGLE_CAPPER" ? (
          <div className="space-y-1.5">
            <Label htmlFor="capper">Capper</Label>
            <select
              id="capper"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className={audienceSelectClassName}
            >
              <option value="">Choose a capper…</option>
              {cappers.map((capper) => (
                <option key={capper.id} value={capper.id}>
                  {capper.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setDuplicateWarning(null);
            }}
            maxLength={150}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="body">Message</Label>
          <EmailBodyField
            id="body"
            value={body}
            onChange={(value) => {
              setBody(value);
              setDuplicateWarning(null);
            }}
            imageBaseUrl={imageBaseUrl}
            rows={8}
            maxLength={10_000}
            disabled={sending}
            unsubscribeNote={isMass}
            onBusyChange={setUploading}
            help={
              <p className="text-muted-foreground text-xs">
                Preview the rendered email in the message editor. Mass emails
                automatically include an unsubscribe link.
              </p>
            }
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="scheduled-at">Schedule (optional)</Label>
            <Input
              id="scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              // Set on focus, not render: the server's clock and time zone
              // differ from the browser's.
              onFocus={(event) => {
                event.currentTarget.min = toLocalInputValue(new Date());
              }}
              aria-describedby="scheduled-at-hint"
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <p id="scheduled-at-hint" className="text-muted-foreground text-xs">
              Your time zone
              <span suppressHydrationWarning>
                {typeof Intl !== "undefined"
                  ? ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
                  : ""}
              </span>
              . Leave empty to send now. The queue sends within about 5 minutes
              of the chosen time, up to the daily Brevo limit; the rest
              continues the next day.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isMass ? (
              <Button
                type="button"
                variant="outline"
                disabled={previewing || sending}
                onClick={() => void runPreview(audience, filters, userId)}
              >
                <Users className="size-4" aria-hidden />
                {count === null ? "Preview audience" : "Re-check"}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={sending || !ready}
              onClick={() => void send()}
            >
              {scheduledAt ? (
                <Clock3 className="size-4" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {scheduledAt
                ? `Schedule${count === null ? "" : ` for ${count}`}`
                : isMass && count !== null
                  ? `Queue for ${count}`
                  : "Send"}
            </Button>
          </div>
        </div>

        {duplicateWarning ? (
          <div
            role="alert"
            className="border-border bg-surface-2 space-y-2 rounded-xl border p-3 text-sm"
          >
            <p>{duplicateWarning}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={sending}
                onClick={() => void send(true)}
              >
                Send it again
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDuplicateWarning(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="min-h-64 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Recipient preview</h2>
            <p className="text-muted-foreground text-xs">
              Opt-outs, restricted accounts, test profiles, duplicate inboxes,
              and unreachable addresses are removed automatically.
            </p>
          </div>
          <span
            aria-live="polite"
            className="bg-primary text-primary-foreground min-w-8 rounded-full px-2.5 py-1 text-center text-xs font-semibold tabular-nums empty:hidden"
          >
            {previewing ? "…" : count !== null ? count : ""}
          </span>
        </div>

        {!isMass ? (
          <p className="text-muted-foreground mt-8 text-center text-sm">
            A direct message goes to the one capper you choose.
          </p>
        ) : preview === null ? (
          <p className="text-muted-foreground mt-8 text-center text-sm">
            {previewing
              ? "Checking who this reaches…"
              : "Preview the audience to see the matching cappers."}
          </p>
        ) : preview.members.length === 0 ? (
          <p className="text-muted-foreground mt-8 text-center text-sm">
            No eligible recipients match these filters.
          </p>
        ) : (
          <ul
            className="mt-4 max-h-[34rem] space-y-2 overflow-y-auto pr-1"
            aria-busy={previewing}
          >
            {preview.members.map((member) => (
              <li
                key={member.id}
                className="border-border bg-surface-2 flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {member.label}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {member.email}
                  </p>
                  {member.lastPlayAt ? (
                    <p className="text-muted-foreground mt-1 text-[0.7rem]">
                      Last play{" "}
                      {new Date(member.lastPlayAt).toLocaleDateString()}
                      {` · ${member.playCount} total`}
                      {member.hasConnectedStorefront ? " · storefront" : ""}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={previewing}
                  aria-label={`Remove ${member.label} from this campaign`}
                  onClick={() => removeMember(member)}
                >
                  <UserMinus className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
