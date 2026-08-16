#!/usr/bin/env node
/**
 * Environment validation for the survey module.
 *
 * Usage: node scripts/check-env.mjs [production|development|stage]
 *
 * Ensures the selected web environment file has all required non-secret
 * Firebase configuration keys populated. Fails before a deploy so a missing
 * production configuration never ships.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] || "production";
const file = join(root, "apps/web", `.env.${target}`);

const REQUIRED = [
  "VITE_ENVIRONMENT",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

if (!existsSync(file)) {
  console.error(`Missing environment file: ${file}`);
  console.error("Copy apps/web/.env.example to apps/web/.env.<environment> and fill it in.");
  process.exit(1);
}

const lines = readFileSync(file, "utf8").split(/\r?\n/);
const values = new Map();
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const equals = trimmed.indexOf("=");
  if (equals === -1) continue;
  const key = trimmed.slice(0, equals).trim();
  const value = trimmed.slice(equals + 1).trim();
  if (!key.startsWith("VITE_")) continue;
  values.set(key, value);
}

const missing = REQUIRED.filter((key) => {
  const value = values.get(key);
  return value === undefined || value === "";
});

if (missing.length > 0) {
  console.error(`Environment "${target}" is missing required values:`);
  for (const key of missing) console.error(`  - ${key}`);
  process.exit(1);
}

const projectId = values.get("VITE_FIREBASE_PROJECT_ID");
if (projectId?.startsWith("demo-")) {
  console.error(`Environment "${target}" points at a demo project ("${projectId}").`);
  process.exit(1);
}
if (projectId?.includes("your-survey")) {
  console.error(`Environment "${target}" still uses a placeholder project ID.`);
  process.exit(1);
}

console.log(`Environment "${target}" is valid (project: ${projectId}).`);
