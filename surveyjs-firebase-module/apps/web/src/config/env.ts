import { z } from "zod";

const environmentSchema = z.object({
  VITE_ENVIRONMENT: z.enum(["development", "stage", "production"]).default("development"),
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
  VITE_FIREBASE_MEASUREMENT_ID: z.string().optional(),
  VITE_FIREBASE_FUNCTIONS_REGION: z.string().min(1).default("us-central1"),
  VITE_USE_EMULATORS: z.enum(["true", "false"]).default("false"),
  /** Optional in a multi-tenant deployment; leave empty to require an organization picker. */
  VITE_DEFAULT_ORG_ID: z.string().optional().default(""),
  VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: z.string().optional(),
  VITE_SENTRY_DSN: z.string().optional(),
});

const parsed = environmentSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error("Invalid public application configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Application configuration is incomplete. See apps/web/.env.example.");
}

export const env = {
  environment: parsed.data.VITE_ENVIRONMENT,
  firebase: {
    apiKey: parsed.data.VITE_FIREBASE_API_KEY,
    authDomain: parsed.data.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: parsed.data.VITE_FIREBASE_PROJECT_ID,
    storageBucket: parsed.data.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: parsed.data.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: parsed.data.VITE_FIREBASE_APP_ID,
  },
  measurementId: parsed.data.VITE_FIREBASE_MEASUREMENT_ID || null,
  functionsRegion: parsed.data.VITE_FIREBASE_FUNCTIONS_REGION,
  useEmulators: parsed.data.VITE_USE_EMULATORS === "true",
  defaultOrgId: parsed.data.VITE_DEFAULT_ORG_ID,
  recaptchaEnterpriseSiteKey: parsed.data.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || null,
  sentryDsn: parsed.data.VITE_SENTRY_DSN || null,
} as const;
