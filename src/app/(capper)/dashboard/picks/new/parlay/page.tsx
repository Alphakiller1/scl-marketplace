"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SectionHeader } from "@/components/scl/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createParlay } from "@/lib/actions/parlay.action";
import { SPORTS, UNIT_MAX, UNIT_MIN, UNIT_STEP } from "@/lib/constants";
import {
  createParlaySchema,
  type CreateParlayFormInput,
  type CreateParlayInput,
} from "@/lib/schemas/parlay.schema";

const SELECT_CLASS =
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border bg-transparent px-3 text-base shadow-xs focus-visible:ring-[3px] focus-visible:outline-none sm:text-sm";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

const emptyLeg = {
  sport: "",
  league: "",
  market: "",
  selection: "",
  oddsAmerican: "",
};

export default function NewParlayPage() {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateParlayFormInput, unknown, CreateParlayInput>({
    resolver: zodResolver(createParlaySchema),
    defaultValues: { units: 1, legs: [{ ...emptyLeg }, { ...emptyLeg }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "legs" });

  async function onSubmit(values: CreateParlayInput) {
    const res = await createParlay(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Parlay submitted");
    router.push("/dashboard/picks");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader
          title="Submit A Parlay"
          subtitle="Two or more legs — logged as pending until graded"
        />
        <Button
          variant="ghost"
          render={<Link href="/dashboard/picks/new" />}
          nativeButton={false}
        >
          Single play
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Card className="space-y-1.5 p-4 sm:p-6">
          <Label htmlFor="units">Stake (units)</Label>
          <Input
            id="units"
            type="number"
            step={UNIT_STEP}
            min={UNIT_MIN}
            max={UNIT_MAX}
            className="sm:max-w-40"
            {...register("units")}
          />
          <p className="text-muted-foreground text-xs">
            The parlay carries the stake; legs are components.
          </p>
          <FieldError message={errors.units?.message} />
        </Card>

        {fields.map((field, i) => (
          <Card key={field.id} className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Leg {i + 1}
              </span>
              {fields.length > 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(i)}
                  aria-label={`Remove leg ${i + 1}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`legs.${i}.sport`}>Sport</Label>
                <select
                  id={`legs.${i}.sport`}
                  className={SELECT_CLASS}
                  defaultValue=""
                  {...register(`legs.${i}.sport`)}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {SPORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.legs?.[i]?.sport?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`legs.${i}.oddsAmerican`}>
                  Odds (American)
                </Label>
                <Input
                  id={`legs.${i}.oddsAmerican`}
                  inputMode="numeric"
                  placeholder="-110"
                  {...register(`legs.${i}.oddsAmerican`)}
                />
                <FieldError message={errors.legs?.[i]?.oddsAmerican?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`legs.${i}.market`}>Market</Label>
                <Input
                  id={`legs.${i}.market`}
                  placeholder="e.g. Moneyline"
                  {...register(`legs.${i}.market`)}
                />
                <FieldError message={errors.legs?.[i]?.market?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`legs.${i}.selection`}>Selection</Label>
                <Input
                  id={`legs.${i}.selection`}
                  placeholder="e.g. Celtics"
                  {...register(`legs.${i}.selection`)}
                />
                <FieldError message={errors.legs?.[i]?.selection?.message} />
              </div>
            </div>
          </Card>
        ))}

        <FieldError message={errors.legs?.message} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ ...emptyLeg })}
            disabled={fields.length >= 12}
          >
            <Plus className="size-4" /> Add leg
          </Button>
          <Button type="submit" disabled={isSubmitting} className="sm:min-w-40">
            {isSubmitting ? "Submitting…" : "Submit parlay"}
          </Button>
        </div>
      </form>
    </div>
  );
}
