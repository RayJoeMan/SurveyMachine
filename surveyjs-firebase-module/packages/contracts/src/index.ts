import { z } from "zod";

const identifier = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, "Use lowercase letters, numbers, hyphens, or underscores.");

export const OrganizationIdSchema = identifier.brand<"OrganizationId">();
export const SurveyIdSchema = identifier.brand<"SurveyId">();
export const PublicSurveyIdSchema = identifier.brand<"PublicSurveyId">();

export const SurveyStatusSchema = z.enum(["draft", "published", "closed", "archived"]);
export type SurveyStatus = z.infer<typeof SurveyStatusSchema>;

export const SurveyModuleRoleSchema = z.enum([
  "org_admin",
  "survey_admin",
  "survey_editor",
  "report_viewer",
]);
export type SurveyModuleRole = z.infer<typeof SurveyModuleRoleSchema>;

export const SurveyJsSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => Array.isArray(value.pages) || Array.isArray(value.elements), {
    message: "SurveyJS JSON must contain a pages or elements array.",
  });
export type SurveyJsJson = z.infer<typeof SurveyJsSchema>;

export const BrandingSchema = z.object({
  organizationName: z.string().min(1).max(120),
  logoUrl: z.url().max(2_048).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#123a63"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#f4b942"),
});
export type SurveyBranding = z.infer<typeof BrandingSchema>;

export const SurveySettingsSchema = z
  .object({
    allowAnonymous: z.boolean().default(true),
    requireAuthentication: z.boolean().default(false),
    saveProgress: z.boolean().default(true),
    responseLimit: z.number().int().positive().max(1_000_000).nullable().default(null),
    closesAt: z.iso.datetime().nullable().default(null),
    locale: z.string().min(2).max(20).default("en"),
  })
  .refine((settings) => settings.allowAnonymous !== settings.requireAuthentication, {
    message: "Exactly one of allowAnonymous or requireAuthentication must be true.",
  });
export type SurveySettings = z.infer<typeof SurveySettingsSchema>;

export const PublicSurveySchema = z.object({
  publicSurveyId: PublicSurveyIdSchema,
  orgId: OrganizationIdSchema,
  surveyId: SurveyIdSchema,
  version: z.number().int().positive(),
  status: z.enum(["published", "closed"]),
  title: z.string().min(1).max(160),
  description: z.string().max(2_000).default(""),
  schema: SurveyJsSchema,
  settings: SurveySettingsSchema,
  branding: BrandingSchema,
  publishedAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
});
export type PublicSurvey = z.infer<typeof PublicSurveySchema>;

export const ResponseMetadataSchema = z.preprocess(
  (value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // The callable protocol serializes absent optional fields as null;
      // normalize null/undefined entries away before validation so optional
      // metadata keys do not fail strict parsing.
      return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined),
      );
    }
    return value;
  },
  z
    .object({
      source: z.string().max(80).optional(),
      campaign: z.string().max(120).optional(),
      medium: z.string().max(80).optional(),
      referrerHost: z.string().max(255).optional(),
    })
    .strict(),
);
export type ResponseMetadata = z.infer<typeof ResponseMetadataSchema>;

const answersSchema = z.record(z.string().max(160), z.unknown());
const clientSubmissionIdSchema = z.uuid();

export const SaveProgressInputSchema = z.object({
  publicSurveyId: PublicSurveyIdSchema,
  clientSubmissionId: clientSubmissionIdSchema,
  answers: answersSchema,
  startedAt: z.iso.datetime(),
  metadata: ResponseMetadataSchema.default({}),
});
export type SaveProgressInput = z.input<typeof SaveProgressInputSchema>;

export const SubmitResponseInputSchema = SaveProgressInputSchema.extend({
  completedAt: z.iso.datetime(),
});
export type SubmitResponseInput = z.input<typeof SubmitResponseInputSchema>;

export const UpsertSurveyInputSchema = z.object({
  orgId: OrganizationIdSchema,
  surveyId: SurveyIdSchema.optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).default(""),
  schema: SurveyJsSchema,
  settings: SurveySettingsSchema,
  branding: BrandingSchema,
  /**
   * Optimistic-concurrency precondition. When provided, the draft is only saved
   * if the stored draftRevision still matches. Conflicts surface as an
   * `aborted` HttpsError with the current revision, so two editors can never
   * silently overwrite each other.
   */
  expectedDraftRevision: z.number().int().nonnegative().optional(),
});
export type UpsertSurveyInput = z.input<typeof UpsertSurveyInputSchema>;

export const SurveyActionInputSchema = z.object({
  orgId: OrganizationIdSchema,
  surveyId: SurveyIdSchema,
});
export type SurveyActionInput = z.input<typeof SurveyActionInputSchema>;

export const ExportOrganizationDataInputSchema = z.object({
  orgId: OrganizationIdSchema,
});
export type ExportOrganizationDataInput = z.input<typeof ExportOrganizationDataInputSchema>;

export const CreateOrganizationInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  orgId: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]*$/, "Use lowercase letters, numbers, hyphens, or underscores.")
    .min(2)
    .max(80)
    .optional(),
});
export type CreateOrganizationInput = z.input<typeof CreateOrganizationInputSchema>;

const RESERVED_ORG_IDS = new Set([
  "admin",
  "demo",
  "demo-org",
  "organization",
  "survey",
  "surveys",
  "test",
]);

export function isReservedOrgId(orgId: string): boolean {
  return RESERVED_ORG_IDS.has(orgId);
}

/**
 * Account emails with organization-wide super-admin access. These identities
 * bypass role checks (but never client-side writes). For commercialization this
 * should move to a trusted configuration document; the constant keeps the
 * default deployment honest and reviewable.
 */
export const SUPER_ADMIN_EMAILS = ["joermnd@gmail.com"] as const;

export function isSuperAdminEmail(email: string | undefined | null): boolean {
  return Boolean(email && (SUPER_ADMIN_EMAILS as readonly string[]).includes(email));
}

/** Deterministic slug used to derive a default organization ID from its name. */
export function slugifyOrganizationName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || "organization";
}

export const ExportSurveyInputSchema = SurveyActionInputSchema.extend({
  format: z.literal("csv").default("csv"),
});
export type ExportSurveyInput = z.input<typeof ExportSurveyInputSchema>;

export const CallableResultSchema = z.object({
  ok: z.literal(true),
  requestId: z.string().min(1),
});

export const OutboxStatusSchema = z.enum(["pending", "processing", "delivered", "failed", "dead"]);
export type OutboxStatus = z.infer<typeof OutboxStatusSchema>;

export const OutboxEventSchema = z.object({
  eventId: z.string().min(1).max(120),
  eventType: z.string().min(1).max(80),
  orgId: OrganizationIdSchema,
  surveyId: SurveyIdSchema.optional(),
  idempotencyKey: z.string().min(1).max(200),
  status: OutboxStatusSchema,
  attempts: z.number().int().nonnegative(),
  nextAttemptAt: z.iso.datetime().nullable(),
  payload: z.record(z.string(), z.unknown()),
  error: z.string().max(500).nullable().default(null),
  createdAt: z.unknown().optional(),
  updatedAt: z.unknown().optional(),
});
export type OutboxEvent = z.infer<typeof OutboxEventSchema>;

export const OUTBOX_MAX_ATTEMPTS = 5;

/** Suggested placeholder for providers that still require credentials. */
export const OUTBOX_PROVIDER_SECRET_PLACEHOLDER = "configured-in-secret-manager";

export const MAX_RESPONSE_BYTES = 700_000;
export const MAX_SURVEY_SCHEMA_BYTES = 700_000;

export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
