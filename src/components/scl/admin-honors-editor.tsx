"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { saveHonorsContentAction } from "@/lib/actions/honors.action";
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
        <Label htmlFor="honors-body">Introduction</Label>
        <textarea
          id="honors-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          maxLength={20000}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Shown above the winners. The Rules and criteria section below it is
          generated from the award configuration, so the published minimums and
          periods always match what is awarded.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save Honors page"}
        </Button>
        <Button
          render={<Link href="/honors" target="_blank" rel="noreferrer" />}
          nativeButton={false}
          type="button"
          variant="outline"
          className="min-h-10"
        >
          Preview public page
        </Button>
      </div>
    </form>
  );
}
