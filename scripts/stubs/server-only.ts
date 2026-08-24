/**
 * `server-only` marks a module as server-side; Next resolves it during the
 * build, but a plain `tsx` process has no such package, so importing any
 * server module (a query, for instance) from a script fails at resolve time.
 *
 * The database smokes in `.github/workflows/ci.yml` need to call those exact
 * query modules, so they run under `tsconfig.smoke.json`, which points
 * `server-only` here. The stub is inert on purpose and is never used by the
 * app build — pointing the app's own tsconfig at it would quietly disable the
 * client-import guard the real package exists to provide.
 */
export {};
