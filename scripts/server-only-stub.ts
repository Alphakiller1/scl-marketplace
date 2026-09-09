/**
 * Stand-in for the `server-only` marker package when a script runs under tsx.
 *
 * `server-only` is not a real dependency: Next's bundler resolves that import
 * itself and throws only when the module is pulled into a client bundle. Node
 * has no such resolver, so any script that reaches a `server-only` module dies
 * with "Cannot find module" before it runs a line — which is why the diagnostics
 * that import Supabase Storage cannot be run today.
 *
 * Mapped in `scripts/tsconfig.scripts.json` so it applies to scripts alone and
 * never to the app build, where the real guard must keep working.
 */
export {};
