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

/**
 * The callable protocol serializes absent optional fields as null; normalize
 * null/undefined entries away before validation so optional keys pass.
 */
function stripNullEntries(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined),
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Billing (Stripe) contracts
// ---------------------------------------------------------------------------

export const BillingPlanSchema = z.enum(["free", "pro", "enterprise"]);
export type BillingPlan = z.infer<typeof BillingPlanSchema>;

export const BillingStatusSchema = z.enum([
  "none",
  "incomplete",
  "trialing",
  "active",
  "past_due",
  "canceled",
]);
export type BillingStatus = z.infer<typeof BillingStatusSchema>;

export const BillingInfoSchema = z.object({
  orgId: OrganizationIdSchema,
  plan: BillingPlanSchema,
  status: BillingStatusSchema,
  stripeCustomerId: z.string().min(1).optional(),
  stripeSubscriptionId: z.string().min(1).optional(),
  currentPeriodEnd: z.iso.datetime().nullable().optional(),
  updatedAt: z.unknown().optional(),
});
export type BillingInfo = z.infer<typeof BillingInfoSchema>;

export const CreateCheckoutInputSchema = z.object({
  orgId: OrganizationIdSchema,
  plan: BillingPlanSchema,
  successUrl: z.url().max(2_048),
  cancelUrl: z.url().max(2_048),
});
export type CreateCheckoutInput = z.input<typeof CreateCheckoutInputSchema>;

export const CreateBillingPortalInputSchema = z.object({
  orgId: OrganizationIdSchema,
  returnUrl: z.url().max(2_048),
});
export type CreateBillingPortalInput = z.input<typeof CreateBillingPortalInputSchema>;

export const CheckoutResultSchema = CallableResultSchema.extend({
  url: z.url(),
  plan: BillingPlanSchema,
});
export type CheckoutResult = z.infer<typeof CheckoutResultSchema>;

export const BillingPortalResultSchema = CallableResultSchema.extend({
  url: z.url(),
});
export type BillingPortalResult = z.infer<typeof BillingPortalResultSchema>;

/** Server-side truth for plan pricing/limits; the web app mirrors the labels. */
export const BILLING_PLAN_DETAILS: Record<
  BillingPlan,
  { label: string; monthlyUsd: number | null; blurb: string }
> = {
  free: { label: "Free", monthlyUsd: null, blurb: "Community use with a single published survey." },
  pro: { label: "Pro", monthlyUsd: 49, blurb: "Unlimited surveys, exports, and standard support." },
  enterprise: {
    label: "Enterprise",
    monthlyUsd: 199,
    blurb: "Everything in Pro plus priority onboarding and support.",
  },
};

/** Default monthly USD amounts used until the platform overrides them. */
export const DEFAULT_PLAN_MONTHLY_USD: Record<BillingPlan, number | null> = {
  free: null,
  pro: 49,
  enterprise: 199,
};

/** Monthly USD pricing for the paid plans, as configured by a super-admin. */
export const PlatformBillingConfigSchema = z.object({
  pro: z.number().int().positive().max(100_000),
  enterprise: z.number().int().positive().max(100_000),
  updatedBy: z.string().min(1).optional(),
  updatedAt: z.unknown().optional(),
});
export type PlatformBillingConfig = z.infer<typeof PlatformBillingConfigSchema>;

export const UpdatePlanPricingInputSchema = z.object({
  pro: z.number().int().positive().max(100_000),
  enterprise: z.number().int().positive().max(100_000),
});
export type UpdatePlanPricingInput = z.input<typeof UpdatePlanPricingInputSchema>;

export const UpdatePlanPricingResultSchema = CallableResultSchema.extend({
  pro: z.number().int().positive(),
  enterprise: z.number().int().positive(),
});
export type UpdatePlanPricingResult = z.infer<typeof UpdatePlanPricingResultSchema>;

// ---------------------------------------------------------------------------
// AI analytics (natural-language survey questions)
// ---------------------------------------------------------------------------

export const AskSurveyDataInputSchema = z.object({
  orgId: OrganizationIdSchema,
  surveyId: SurveyIdSchema,
  question: z.string().trim().min(3).max(1_000),
});
export type AskSurveyDataInput = z.input<typeof AskSurveyDataInputSchema>;

export const AskSurveyDataResultSchema = CallableResultSchema.extend({
  answer: z.string().min(1),
  provider: z.string(),
  model: z.string(),
});
export type AskSurveyDataResult = z.infer<typeof AskSurveyDataResultSchema>;

// ---------------------------------------------------------------------------
// Organization settings, branding, and member management
// ---------------------------------------------------------------------------

export const OrgBrandingSchema = z.preprocess(
  (value) => stripNullEntries(value),
  z.object({
    organizationName: z.string().trim().min(1).max(120),
    logoUrl: z.url().max(2_048).optional(),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#123a63"),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default("#f4b942"),
  }),
);
export type OrgBranding = z.infer<typeof OrgBrandingSchema>;

export const UpdateOrganizationInputSchema = z.preprocess(
  (value) => stripNullEntries(value),
  z.object({
    orgId: OrganizationIdSchema,
    name: z.string().trim().min(1).max(120).optional(),
    branding: OrgBrandingSchema.optional(),
  }),
);
export type UpdateOrganizationInput = z.input<typeof UpdateOrganizationInputSchema>;

export const UpdateOrganizationResultSchema = CallableResultSchema.extend({
  name: z.string().min(1),
});
export type UpdateOrganizationResult = z.infer<typeof UpdateOrganizationResultSchema>;

export const MemberSummarySchema = z.object({
  uid: z.string().min(1),
  email: z.string().email().optional(),
  displayName: z.string().max(200).optional(),
  roles: z.array(SurveyModuleRoleSchema).min(1),
  active: z.boolean(),
  createdAt: z.unknown().optional(),
});
export type MemberSummary = z.infer<typeof MemberSummarySchema>;

export const InviteMemberInputSchema = z.object({
  orgId: OrganizationIdSchema,
  email: z.string().email().max(254),
  roles: z.array(SurveyModuleRoleSchema).min(1).max(4),
});
export type InviteMemberInput = z.input<typeof InviteMemberInputSchema>;

export const UpdateMemberRolesInputSchema = z.object({
  orgId: OrganizationIdSchema,
  uid: z.string().min(1).max(128),
  roles: z.array(SurveyModuleRoleSchema).min(1).max(4),
});
export type UpdateMemberRolesInput = z.input<typeof UpdateMemberRolesInputSchema>;

export const RemoveMemberInputSchema = z.object({
  orgId: OrganizationIdSchema,
  uid: z.string().min(1).max(128),
});
export type RemoveMemberInput = z.input<typeof RemoveMemberInputSchema>;

export const ClaimInvitationInputSchema = z.object({
  orgId: OrganizationIdSchema,
  invitationId: z.string().min(1).max(254),
});
export type ClaimInvitationInput = z.input<typeof ClaimInvitationInputSchema>;

export const ListMembersResultSchema = CallableResultSchema.extend({
  members: z.array(MemberSummarySchema),
});
export type ListMembersResult = z.infer<typeof ListMembersResultSchema>;

export const InviteMemberResultSchema = CallableResultSchema.extend({
  invitationId: z.string().min(1),
});
export type InviteMemberResult = z.infer<typeof InviteMemberResultSchema>;

export const RecomputeAggregatesResultSchema = CallableResultSchema.extend({
  scanned: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  totalDurationMs: z.number().nonnegative(),
});
export type RecomputeAggregatesResult = z.infer<typeof RecomputeAggregatesResultSchema>;
