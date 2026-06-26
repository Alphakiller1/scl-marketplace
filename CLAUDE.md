@AGENTS.md

# Claude Code — repo notes

The shared agent guide above (`AGENTS.md`) is authoritative. A few Claude-specific notes:

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
