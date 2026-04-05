#!/usr/bin/env node
/**
 * Environment Variables Validation Script
 * 
 * Validates that all required environment variables are set before starting the application.
 * Run this script during startup or in CI/CD pipelines to catch missing configuration early.
 * 
 * Usage:
 *   npm run validate-env
 *   node scripts/validate-env.ts
 */

// Load .env.local file (Next.js doesn't load it for standalone scripts)
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

interface EnvVar {
  name: string;
  required: boolean;
  description?: string;
  validate?: (value: string) => boolean | string;
}

const requiredEnvVars: EnvVar[] = [
  // Firebase Configuration (REQUIRED)
  {
    name: "NEXT_PUBLIC_FIREBASE_API_KEY",
    required: true,
    description: "Firebase API Key",
    validate: (value) => value !== "your-api-key" || "Must be set to actual Firebase API key",
  },
  {
    name: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    required: true,
    description: "Firebase Auth Domain",
    validate: (value) => !value.includes("your-project") || "Must be set to actual Firebase project domain",
  },
  {
    name: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    required: true,
    description: "Firebase Project ID",
    validate: (value) => value !== "your-project-id" || "Must be set to actual Firebase project ID",
  },
  {
    name: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    required: true,
    description: "Firebase Storage Bucket",
    validate: (value) => !value.includes("your-project") || "Must be set to actual Firebase storage bucket",
  },
  {
    name: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    required: true,
    description: "Firebase Messaging Sender ID",
    validate: (value) => value !== "your-sender-id" || "Must be set to actual Firebase sender ID",
  },
  {
    name: "NEXT_PUBLIC_FIREBASE_APP_ID",
    required: true,
    description: "Firebase App ID",
    validate: (value) => value !== "your-app-id" || "Must be set to actual Firebase app ID",
  },
  {
    name: "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
    required: true,
    description: "Firebase Database URL",
    validate: (value) => !value.includes("your-project") || "Must be set to actual Firebase database URL",
  },
];

const optionalEnvVars: EnvVar[] = [
  // Discord OAuth (OPTIONAL)
  {
    name: "NEXT_PUBLIC_DISCORD_CLIENT_ID",
    required: false,
    description: "Discord OAuth Client ID",
  },
  {
    name: "DISCORD_CLIENT_SECRET",
    required: false,
    description: "Discord OAuth Client Secret",
  },
  {
    name: "NEXT_PUBLIC_DISCORD_REDIRECT_URI",
    required: false,
    description: "Discord OAuth Redirect URI",
  },
  {
    name: "CURSOR_BOSTON_DISCORD_SERVER_ID",
    required: false,
    description: "Discord Server ID",
  },
  // GitHub OAuth (OPTIONAL)
  {
    name: "NEXT_PUBLIC_GITHUB_CLIENT_ID",
    required: false,
    description: "GitHub OAuth Client ID",
  },
  {
    name: "GITHUB_CLIENT_SECRET",
    required: false,
    description: "GitHub OAuth Client Secret",
  },
  {
    name: "NEXT_PUBLIC_GITHUB_REDIRECT_URI",
    required: false,
    description: "GitHub OAuth Redirect URI",
  },
  {
    name: "GITHUB_WEBHOOK_SECRET",
    required: false,
    description: "GitHub Webhook Secret",
  },
  {
    name: "GITHUB_REPO_OWNER",
    required: false,
    description: "GitHub Repository Owner",
  },
  {
    name: "GITHUB_REPO_NAME",
    required: false,
    description: "GitHub Repository Name",
  },
  {
    name: "HACK_A_SPRINT_2026_JUDGE_UIDS",
    required: false,
    description:
      "Comma-separated Firebase UIDs allowed to vote in judge channel for Hack-a-Sprint 2026 showcase",
  },
  {
    name: "HACK_A_SPRINT_2026_JUDGE_EMAILS",
    required: false,
    description:
      "Comma-separated judge emails (lowercase) for Hack-a-Sprint 2026 judge votes; matched to auth + profile emails",
  },
  {
    name: "HACK_A_SPRINT_2026_EVENT_PASSCODE",
    required: false,
    description:
      "In-person event passcode for Hack-a-Sprint 2026 unlock on the showcase page (server-only)",
  },
  {
    name: "FIREBASE_SERVICE_ACCOUNT_JSON",
    required: false,
    description: "Firebase Admin service account JSON (for webhooks)",
  },
  // Admin Email (OPTIONAL)
  {
    name: "ADMIN_EMAIL",
    required: false,
    description: "Admin Email for notifications",
  },
  // Mailgun (OPTIONAL - for sending emails)
  {
    name: "MAILGUN_API_KEY",
    required: false,
    description: "Mailgun API key for sending emails",
  },
  {
    name: "MAILGUN_DOMAIN",
    required: false,
    description: "Mailgun sending domain (e.g. mg.example.com)",
  },
];

function validateEnvVar(envVar: EnvVar): { valid: boolean; error?: string } {
  const value = process.env[envVar.name];

  if (envVar.required) {
    if (!value || value.trim() === "") {
      return {
        valid: false,
        error: `Required environment variable ${envVar.name} is not set`,
      };
    }

    if (envVar.validate) {
      const validationResult = envVar.validate(value);
      if (validationResult !== true) {
        return {
          valid: false,
          error: typeof validationResult === "string" 
            ? validationResult 
            : `Invalid value for ${envVar.name}`,
        };
      }
    }
  }

  return { valid: true };
}

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log("🔍 Validating environment variables...\n");

  // Check required variables
  console.log("📋 Checking required variables:");
  for (const envVar of requiredEnvVars) {
    const result = validateEnvVar(envVar);
    if (result.valid) {
      console.log(`  ✅ ${envVar.name}`);
    } else {
      console.log(`  ❌ ${envVar.name}: ${result.error}`);
      errors.push(result.error || `${envVar.name} is invalid`);
    }
  }

  // Check optional variables (for warnings)
  console.log("\n📋 Checking optional variables:");
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar.name];
    if (value && value.trim() !== "") {
      console.log(`  ✅ ${envVar.name} (set)`);
    } else {
      console.log(`  ⚠️  ${envVar.name} (not set - optional)`);
      warnings.push(`${envVar.name} is not set (optional)`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  if (errors.length === 0) {
    console.log("✅ All required environment variables are set!");
    if (warnings.length > 0) {
      console.log(`\n⚠️  ${warnings.length} optional variable(s) not set (this is OK)`);
    }
    process.exit(0);
  } else {
    console.log(`❌ Found ${errors.length} error(s):`);
    errors.forEach((error) => console.log(`   - ${error}`));
    console.log("\n💡 Tip: Copy .env.local.example to .env.local and fill in the values");
    process.exit(1);
  }
}

// Run validation when script is executed directly
// tsx executes this file directly, so main() will run
// When imported as a module, main() won't execute (which is fine)
try {
  if (process.argv[1]?.includes('validate-env') || process.argv[0]?.includes('tsx')) {
    main();
  }
} catch (e) {
  // Silently fail if this is imported as a module
}

export { validateEnvVar, requiredEnvVars, optionalEnvVars };
