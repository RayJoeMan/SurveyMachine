import { setGlobalOptions } from "firebase-functions/v2";
import { initMonitoring } from "./core/monitoring";

initMonitoring();

setGlobalOptions({
  region: "us-central1",
  maxInstances: 20,
  concurrency: 40,
  timeoutSeconds: 60,
  memory: "256MiB",
});

export {
  closeSurveyV1,
  publishSurveyV1,
  upsertSurveyV1,
  deleteSurveyV1,
} from "./surveys/admin.callables";
export { saveSurveyProgressV1, submitSurveyResponseV1 } from "./surveys/respondent.callables";
export { createSurveyExportV1 } from "./reporting/export.callable";
export {
  createOrganizationV1,
  exportOrganizationDataV1,
  updateOrganizationV1,
} from "./organization";
export { createCheckoutSessionV1, createBillingPortalSessionV1 } from "./billing/checkout.callable";
export { stripeWebhookV1 } from "./billing/webhook";
export { updatePlanPricingV1 } from "./billing/config.callable";
export { askSurveyDataV1 } from "./analytics/ask.callable";
export { recomputeSurveyAggregatesV1 } from "./reporting/recompute.callable";
export {
  claimInvitationV1,
  inviteMemberV1,
  listMembersV1,
  removeMemberV1,
  updateMemberRolesV1,
} from "./members.callable";
export { updateSurveySummaryV1 } from "./reporting/response.trigger";
export { processOutboxV1 } from "./reporting/outbox";
