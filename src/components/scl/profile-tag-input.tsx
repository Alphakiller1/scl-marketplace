"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProfileTagInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
};

export function ProfileTagInput({
  value,
  onChange,
  max = 8,
}: ProfileTagInputProps) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const tag = draft.trim().replace(/\s+/g, " ");
    if (!tag || value.length >= max) return;
    if (value.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          maxLength={40}
          placeholder="Player Props"
          className="min-h-10"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Add Specialty"
          title="Add Specialty"
          onClick={addTag}
          disabled={!draft.trim() || value.length >= max}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {value.length ? (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="border-border bg-surface-2 inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-2.5 text-sm"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                title={`Remove ${tag}`}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mr-2 flex size-11 items-center justify-center rounded-lg outline-none focus-visible:ring-2"
                onClick={() => onChange(value.filter((item) => item !== tag))}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
