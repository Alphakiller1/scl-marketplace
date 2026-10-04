import assert from "node:assert/strict";

import {
  retrieveWhopApp,
  updateWhopAppRequestedPermissions,
} from "@/lib/whop-api";
import {
  hasRequiredWhopAppPermission,
  mergeRequiredWhopAppPermission,
  WHOP_PLAN_READ_PERMISSION,
} from "@/lib/whop-app-permissions";
import { whopAccountApiKey, whopAppApiKey, whopAppId } from "@/lib/whop-config";
import { ensureWhopOAuthRedirectRegistered } from "@/lib/whop-oauth-register";

async function main() {
  const appId = whopAppId();
  assert(appId, "WHOP_APP_ID is required.");

  const credentials = Array.from(
    new Map(
      [
        ["app", whopAppApiKey()],
        ["account", whopAccountApiKey()],
      ]
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        .map(([kind, token]) => [token, { kind, token }]),
    ).values(),
  );
  assert(
    credentials.length > 0,
    "WHOP_APP_API_KEY or WHOP_API_KEY is required.",
  );

  const failures: string[] = [];
  let permissionReady = false;
  let observedRedirectUris: string[] = [];
  for (const credential of credentials) {
    try {
      const app = await retrieveWhopApp(credential.token, appId);
      observedRedirectUris = app.redirect_uris ?? [];
      if (hasRequiredWhopAppPermission(app.requested_permissions)) {
        console.info(
          `${WHOP_PLAN_READ_PERMISSION} is already a required permission on ${appId}.`,
        );
        permissionReady = true;
        break;
      }

      await updateWhopAppRequestedPermissions({
        accessToken: credential.token,
        appId,
        requestedPermissions: mergeRequiredWhopAppPermission(
          app.requested_permissions,
        ),
      });

      const verified = await retrieveWhopApp(credential.token, appId);
      assert(
        hasRequiredWhopAppPermission(verified.requested_permissions),
        `Whop accepted the update but ${WHOP_PLAN_READ_PERMISSION} was not returned as required.`,
      );
      console.info(
        `Added ${WHOP_PLAN_READ_PERMISSION} as a required install permission on ${appId}; existing permissions were preserved.`,
      );
      permissionReady = true;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${credential.kind}: ${message}`);
    }
  }

  if (!permissionReady) {
    throw new Error(
      `No configured Whop credential could update ${appId}. ${failures.join(" | ")}`,
    );
  }

  console.info(
    `Whop currently allows these OAuth callbacks: ${observedRedirectUris.length > 0 ? observedRedirectUris.join(", ") : "(none)"}`,
  );

  const redirectStatus = await ensureWhopOAuthRedirectRegistered();
  assert.equal(
    redirectStatus,
    "ok",
    "Whop OAuth callback is not registered. WHOP_API_KEY must carry developer:update_app so SCL can repair the app allowlist.",
  );
  console.info("SCL's production Whop OAuth callback is registered.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
