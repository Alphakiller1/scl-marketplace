import assert from "node:assert/strict";
import test from "node:test";
import { loadTestModule } from "@/lib/test-support/load-module";
import * as corrections from "@/lib/grading-correction";
import * as schema from "@/lib/schemas/grading.schema";
import type { AdminGradeCorrection } from "@/components/scl/admin-grade-correction";

type Node = { type: unknown; props: Record<string, unknown> };
function findNodes(value: unknown, type: string): Node[] {
  if (Array.isArray(value))
    return value.flatMap((child) => findNodes(child, type));
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [
    ...(node.type === type ? [node] : []),
    ...findNodes(node.props.children, type),
  ];
}

test("admin can submit one stale leg while leaving unfinished legs pending", async () => {
  for (const allowSave of [true, false]) {
    let hook = 0;
    const state = [
      "Verified final result",
      allowSave,
      false,
      "WIN",
      { stale: "WIN", future: "PENDING" },
    ];
    const submitted: unknown[] = [];
    const jsx = (type: unknown, props: Record<string, unknown>) => ({
      type,
      props,
    });
    const form = loadTestModule<{
      AdminGradeCorrection: typeof AdminGradeCorrection;
    }>("src/components/scl/admin-grade-correction.tsx", {
      "react/jsx-runtime": { jsx, jsxs: jsx },
      react: { useState: () => [state[hook++], () => {}] },
      "lucide-react": {},
      "next/navigation": { useRouter: () => ({ refresh: () => {} }) },
      sonner: { toast: { success: () => {}, error: () => {} } },
      "@/components/scl/badges": {},
      "@/components/ui/button": { Button: "button" },
      "@/lib/actions/grading.action": {},
      "@/lib/actions/parlay.action": {
        gradeParlayAction: async (input: unknown) => {
          submitted.push(input);
          return { ok: true };
        },
      },
      "@/lib/format": {},
      "@/lib/grading-correction": corrections,
      "@/lib/schemas/grading.schema": schema,
    });
    const tree = form.AdminGradeCorrection({
      kind: "parlay",
      id: "ticket",
      outcome: "PENDING",
      profitUnits: null,
      units: 2,
      legs: ["stale", "future"].map((id) => ({
        id,
        outcome: "PENDING",
        oddsAmerican: -110,
        selection: id,
        market: "Moneyline",
      })),
    });
    const button = findNodes(tree, "button")[0]!;
    assert.equal(button.props.disabled, !allowSave);
    assert.ok(
      findNodes(tree, "option")
        .filter((option) => option.props.value === "PENDING")
        .every((option) => !option.props.disabled),
    );
    await (button.props.onClick as () => Promise<void>)();
    assert.equal(submitted.length, allowSave ? 1 : 0);
    if (allowSave) {
      assert.deepEqual(JSON.parse(JSON.stringify(submitted[0])), {
        parlayId: "ticket",
        reason: "Verified final result",
        expectedOutcome: "PENDING",
        expectedProfitUnits: null,
        confirmedPublicImpact: true,
        legs: [{ playId: "stale", outcome: "WIN", expectedOutcome: "PENDING" }],
      });
    }
  }
});
