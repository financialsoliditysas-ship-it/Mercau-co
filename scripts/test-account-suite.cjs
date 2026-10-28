const { spawnSync } = require("node:child_process");
const scripts = [
  "test-buyer-security.cjs",
  "test-buyer-visual.cjs",
  "test-account-age.cjs",
  "test-account-workspace.cjs",
  "test-account-gallery.cjs",
  "test-account-delivery-auth.cjs",
  "test-business-edit.cjs",
  "test-business-photo.cjs",
  "test-catalog.cjs",
  "test-product-options.cjs",
  "test-finance.cjs",
  "test-business-public-links.cjs",
  "test-business-registration-flow.cjs",
  "test-business-push.cjs",
  "test-ux-action-reveal.cjs",
  "test-launch-tracking.cjs",
  "test-admin-catalog-support.cjs",
  "test-unclaimed-business.cjs",
  "test-shared-catalog-options.cjs",
  "test-directory-responsive.cjs",
  "test-admin-product-photos-orders.cjs",
  "test-business-social-thumbnail.cjs",
];
for (const script of scripts) {
  const result = spawnSync(process.execPath, ["scripts/" + script], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(
  `PASS ${scripts.length} isolated suites. No production services used.`,
);
