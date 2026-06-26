@AGENTS.md

# Claude Code — repo notes

The shared agent guide above (`AGENTS.md`) is authoritative, along with the foundation docs in
`docs/` — read these before building UI:

- `docs/SCL_PHASE_1_PRODUCT_SPEC.md` — what we're building + IA + pages
- `docs/SCL_DESIGN_CONTRACT.md` — tokens, typography, motion (the visual law)
- `docs/SCL_COMPONENT_SYSTEM.md` — the SCL-native components in `src/components/scl/`
- `docs/SCL_UI_QUALITY_CHECKLIST.md` — the gate every UI PR must pass
- `docs/SCL_DATA_CONTRACT.md`, `docs/SCL_MOBILE_FIRST_RULES.md`,
  `docs/SCL_ACCESSIBILITY_AND_PERFORMANCE.md`, `docs/SCL_COMPETITOR_STANDARD.md`,
  `docs/SCL_AGENT_WORKFLOW.md`

A few Claude-specific notes:

- **Planning lives elsewhere.** Feature prompts, the command center, QA checklists, owner
  decisions, and GitHub-issue mapping are in the separate `SCL` workspace
  (`/Users/chase/Projects/SCL`). When implementing a feature, open the matching
  `_prompts/NN_*.md` there first.
- **Database:** SCL uses the Supabase "betting-brain" instance but is isolated in the **`scl`**
  schema. Connection strings are in `.env` (gitignored). Never touch the `public` schema.
- **Verify before claiming done:** run `npm run typecheck && npm run lint && npm run build`.
  For DB changes, confirm tables landed in `scl` and `public` is unchanged.
- **Git:** `main` is protected — branch + PR. End commits with the Co-Authored-By trailer.
- **Don't guess Next 16 / Base UI APIs** — read `node_modules/next/dist/docs/` and
  `src/components/ui/*`. shadcn here is Base UI: use `render`, not `asChild`.
