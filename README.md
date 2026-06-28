# SCL — Sports Capper Leaderboard (App)

Phase 1 marketplace foundation. Planning, prompts, and QA live in the separate `SCL` workspace.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Base UI primitives) + `next-themes` (dark mode default)
- **Prisma 6** + **PostgreSQL**
- **Auth.js (NextAuth v5)** — credentials + email verification, capper/admin roles
- **TanStack Query/Table**, **Recharts**, **Motion**, **lucide-react**
- **react-hook-form** + **Zod**

## Getting Started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, AUTH_SECRET, etc.
npm run db:push        # apply schema to your Postgres DB
npm run dev            # http://localhost:3000
```

Generate an auth secret with `npx auth secret`. You need a PostgreSQL database
(local, or hosted on Neon/Supabase) for `db:push` / `db:migrate`.

## Scripts

| Script               | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Dev server                                    |
| `npm run build`      | Production build                              |
| `npm run typecheck`  | `tsc --noEmit`                                |
| `npm run lint`       | ESLint                                        |
| `npm run db:push`    | Push Prisma schema to DB (no migration files) |
| `npm run db:migrate` | Create + apply a dev migration                |
| `npm run db:studio`  | Prisma Studio                                 |

## Structure

```
prisma/schema.prisma      # Data model: auth, cappers, plays, parlays, packages, grading
src/app/                  # App Router pages
src/components/ui/         # shadcn/ui components
src/components/providers/  # Theme + React Query providers
src/lib/prisma.ts          # Prisma client singleton
```

## Phase 1 Scope

Tracked as GitHub issues (labels `phase-1`, `M1-onboarding`, …). See the `SCL`
planning workspace for the command center, feature prompts, and QA checklists.
