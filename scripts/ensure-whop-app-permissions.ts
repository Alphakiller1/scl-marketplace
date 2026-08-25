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
  for (const credential of credentials) {
    try {
      const app = await retrieveWhopApp(credential.token, appId);
      if (hasRequiredWhopAppPermission(app.requested_permissions)) {
        console.info(
          `${WHOP_PLAN_READ_PERMISSION} is already a required permission on ${appId}.`,
        );
        return;
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
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${credential.kind}: ${message}`);
    }
  }

  throw new Error(
    `No configured Whop credential could update ${appId}. ${failures.join(" | ")}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
