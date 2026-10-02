"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Save, Send, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";

import { EmailBodyField } from "@/components/scl/email-body-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
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

const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

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
  const [count, setCount] = useState<number | null>(null);
  const [members, setMembers] = useState<PreviewMember[]>([]);
  const [busy, setBusy] = useState(Boolean(initialFilters));
  const [uploading, setUploading] = useState(0);
  const previewRequestId = useRef(0);

  const isMass = audience !== "SINGLE_CAPPER";

  async function preview(nextFilters: AudienceFilters = filters) {
    const requestId = ++previewRequestId.current;
    setBusy(true);
    try {
      const result = await previewBroadcastAudienceAction({
        audience,
        userId,
        filters: isMass ? nextFilters : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (requestId !== previewRequestId.current) return;
      setCount(result.count);
      setMembers(result.members);
    } catch {
      toast.error("Couldn't check the recipient list. Try again.");
    } finally {
      if (requestId === previewRequestId.current) setBusy(false);
    }
  }

  useEffect(() => {
    if (!initialFilters) return;
    let current = true;
    const requestId = ++previewRequestId.current;
    void previewBroadcastAudienceAction({
      audience: "FILTERED_CAPPERS",
      filters: initialFilters,
    })
      .then((result) => {
        if (!current || requestId !== previewRequestId.current) return;
        if (!result.ok) return toast.error(result.error);
        setCount(result.count);
        setMembers(result.members);
      })
      .catch(() => {
        if (current && requestId === previewRequestId.current) {
          toast.error("Couldn't load that dashboard audience.");
        }
      })
      .finally(() => {
        if (current && requestId === previewRequestId.current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [initialFilters]);

  function updateFilters(patch: Partial<AudienceFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    setSelectedGroupId("");
    setCount(null);
    setMembers([]);
    void preview(next);
  }

  function chooseSavedGroup(groupId: string) {
    setSelectedGroupId(groupId);
    const group = savedGroups.find((item) => item.id === groupId);
    if (!group) return;
    setAudience("FILTERED_CAPPERS");
    setFilters(group.filters);
    setGroupName(group.name);
    setCount(null);
    setMembers([]);
    void preview(group.filters);
  }

  function removeMember(member: PreviewMember) {
    const next = {
      ...filters,
      excludeUserIds: [...new Set([...filters.excludeUserIds, member.id])],
    };
    setFilters(next);
    setMembers((current) => current.filter((item) => item.id !== member.id));
    setCount((current) => (current === null ? null : Math.max(0, current - 1)));
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

  async function send() {
    setBusy(true);
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
        confirmRecipientCount: isMass && count !== null ? count : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        setCount(null);
        return;
      }
      toast.success(
        scheduledAt
          ? `Campaign scheduled for ${result.recipientCount} recipients.`
          : `Campaign queued for ${result.recipientCount} recipients.`,
      );
      setSubject("");
      setBody("");
      setScheduledAt("");
      setCount(null);
      setMembers([]);
    } catch {
      toast.error("Couldn't queue the email. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const ready =
    subject.trim().length >= 3 &&
    body.trim().length >= 10 &&
    uploading === 0 &&
    (!isMass || count !== null) &&
    (audience !== "SINGLE_CAPPER" || Boolean(userId));

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
                onClick={() => {
                  setAudience(item.value);
                  if (item.value !== "FILTERED_CAPPERS") {
                    setSelectedGroupId("");
                  }
                  setCount(null);
                  setMembers([]);
                }}
                aria-pressed={audience === item.value}
                className={`min-h-10 rounded-xl border px-3 text-sm transition-colors ${
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FilterSelect
                label="Recently joined"
                value={filters.joinedWithinDays?.toString() ?? ""}
                onChange={(value) =>
                  updateFilters({
                    joinedWithinDays: value
                      ? (Number(value) as 7 | 14 | 30)
                      : null,
                  })
                }
                options={[
                  ["", "Any time"],
                  ["7", "Last 7 days"],
                  ["14", "Last 14 days"],
                  ["30", "Last 30 days"],
                ]}
              />
              <FilterSelect
                label="Account"
                value={filters.accountActivity}
                onChange={(value) =>
                  updateFilters({
                    accountActivity:
                      value as AudienceFilters["accountActivity"],
                  })
                }
                options={[
                  ["ANY", "Any status"],
                  ["ACTIVE", "Active"],
                  ["INACTIVE", "Inactive"],
                ]}
              />
              <FilterSelect
                label="No plays"
                value={filters.noPlaysWithinDays?.toString() ?? ""}
                onChange={(value) =>
                  updateFilters({
                    noPlaysWithinDays: value
                      ? (Number(value) as 3 | 7 | 14 | 30)
                      : null,
                  })
                }
                options={[
                  ["", "Any activity"],
                  ["3", "Last 3 days"],
                  ["7", "Last 7 days"],
                  ["14", "Last 14 days"],
                  ["30", "Last 30 days"],
                ]}
              />
              <FilterSelect
                label="Verification"
                value={filters.verification}
                onChange={(value) =>
                  updateFilters({
                    verification: value as AudienceFilters["verification"],
                  })
                }
                options={[
                  ["ANY", "Any verification"],
                  ["VERIFIED", "Verified"],
                  ["UNVERIFIED", "Unverified"],
                ]}
              />
              <FilterSelect
                label="Play history"
                value={filters.playHistory}
                onChange={(value) =>
                  updateFilters({
                    playHistory: value as AudienceFilters["playHistory"],
                  })
                }
                options={[
                  ["ANY", "Any history"],
                  ["HAS_PLAYS", "Has submitted plays"],
                  ["NEVER_SUBMITTED", "Never submitted"],
                ]}
              />
              <FilterSelect
                label="Storefront"
                value={filters.storefront}
                onChange={(value) =>
                  updateFilters({
                    storefront: value as AudienceFilters["storefront"],
                  })
                }
                options={[
                  ["ANY", "Any storefront"],
                  ["CONNECTED", "Connected"],
                  ["NOT_CONNECTED", "Not connected"],
                  ["AWAITING_REVIEW", "Awaiting SCL review"],
                ]}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-muted-foreground text-xs font-semibold uppercase">
                    Saved groups
                  </span>
                  <select
                    value={selectedGroupId}
                    onChange={(event) => chooseSavedGroup(event.target.value)}
                    className={selectClassName}
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
              <Button
                type="button"
                variant="outline"
                className="self-end"
                disabled={groupName.trim().length < 2}
                onClick={() => void saveGroup()}
              >
                <Save className="size-4" aria-hidden /> Save group
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Current audience: {audienceLabel(filters)}
              {filters.excludeUserIds.length
                ? ` · ${filters.excludeUserIds.length} manually removed`
                : ""}
            </p>
          </div>
        ) : null}

        {audience === "SINGLE_CAPPER" ? (
          <div className="space-y-1.5">
            <Label htmlFor="capper">Capper</Label>
            <select
              id="capper"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className={selectClassName}
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
            onChange={(event) => setSubject(event.target.value)}
            maxLength={150}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="body">Message</Label>
          <EmailBodyField
            id="body"
            value={body}
            onChange={setBody}
            imageBaseUrl={imageBaseUrl}
            rows={8}
            maxLength={10_000}
            disabled={busy}
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
          <label className="space-y-1">
            <span className="text-muted-foreground text-xs font-semibold uppercase">
              Schedule (optional)
            </span>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {isMass ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void preview()}
              >
                <Users className="size-4" aria-hidden />
                {count === null ? "Preview audience" : "Re-check"}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={busy || !ready}
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
          {count !== null ? (
            <span className="bg-primary text-primary-foreground rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums">
              {count}
            </span>
          ) : null}
        </div>

        {count === null ? (
          <p className="text-muted-foreground mt-8 text-center text-sm">
            Preview the audience to see the matching cappers.
          </p>
        ) : members.length === 0 ? (
          <p className="text-muted-foreground mt-8 text-center text-sm">
            No eligible recipients match these filters.
          </p>
        ) : (
          <ul className="mt-4 max-h-[34rem] space-y-2 overflow-y-auto pr-1">
            {members.map((member) => (
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
                {isMass ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${member.label} from this campaign`}
                    onClick={() => removeMember(member)}
                  >
                    <UserMinus className="size-4" aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-muted-foreground text-xs font-semibold uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "any"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
