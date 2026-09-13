"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  saveHonorsContentAction,
  snapshotCurrentHonorsAction,
} from "@/lib/actions/honors.action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminHonorsEditor({
  title: initialTitle,
  body: initialBody,
}: {
  title: string;
  body: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [pending, startTransition] = useTransition();
  const [snapshotPending, startSnapshotTransition] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveHonorsContentAction({ title, body });
          if (result.ok) toast.success("Honors page updated");
          else toast.error(result.error);
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="honors-title">Page title</Label>
        <Input
          id="honors-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="honors-body">Rules and criteria</Label>
        <textarea
          id="honors-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          maxLength={20000}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save Honors page"}
      </Button>
      <div className="border-border space-y-2 border-t pt-4">
        <p className="text-muted-foreground text-sm">
          Save the current qualified winners into their permanent Trophy Cases.
          Re-running this during the same period updates the same awards.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={snapshotPending}
          onClick={() => {
            startSnapshotTransition(async () => {
              const result = await snapshotCurrentHonorsAction();
              if (result.ok)
                toast.success(`${result.count} award winners saved`);
              else toast.error(result.error);
            });
          }}
        >
          {snapshotPending ? "Saving winners…" : "Save current award winners"}
        </Button>
      </div>
    </form>
  );
}
