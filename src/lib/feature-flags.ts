/**
 * Feature flag system for SCL admin features.
 * Flags are controlled via environment variables.
 */

export function isFeatureEnabled(featureName: string): boolean {
  const envVar = `FEATURE_${featureName.toUpperCase()}`;
  return process.env[envVar] === "true";
}

export const features = {
  adminStorefrontWorkflow: () => isFeatureEnabled("admin_storefront_workflow"),
};
