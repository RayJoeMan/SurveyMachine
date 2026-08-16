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

export const ResponseMetadataSchema = z
  .object({
    source: z.string().max(80).optional(),
    campaign: z.string().max(120).optional(),
    medium: z.string().max(80).optional(),
    referrerHost: z.string().max(255).optional(),
  })
  .strict();
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

export const ExportSurveyInputSchema = SurveyActionInputSchema.extend({
  format: z.literal("csv").default("csv"),
});
export type ExportSurveyInput = z.input<typeof ExportSurveyInputSchema>;

export const CallableResultSchema = z.object({
  ok: z.literal(true),
  requestId: z.string().min(1),
});

export const MAX_RESPONSE_BYTES = 700_000;
export const MAX_SURVEY_SCHEMA_BYTES = 700_000;

export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
