/**
 * Validate env before build (warn only unless CI and Firebase client keys missing).
 */

const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const isCi = process.env.CI === "true" || process.env.VERCEL === "1";

function main() {
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.warn("[validate-env] Missing (may be OK for local lint):", missing.join(", "));
    if (isCi) {
      console.error("[validate-env] Required in CI/build");
      process.exit(1);
    }
  } else {
    console.log("[validate-env] Firebase client env OK");
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) {
    console.warn(
      "[validate-env] FIREBASE_SERVICE_ACCOUNT_JSON not set — API routes need it in production",
    );
  }
  if (!process.env.COHORT_INVITE_CODE?.trim()) {
    console.warn("[validate-env] COHORT_INVITE_CODE not set — join workspace will fail");
  }
}

main();
