import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type {
  AskSurveyDataInput,
  AskSurveyDataResult,
  BillingInfo,
  BillingPlan,
  CreateBillingPortalInput,
  CreateCheckoutInput,
  UpdatePlanPricingInput,
} from "@/contracts";
import { db, functions } from "@/firebase/client";

interface CheckoutResult {
  ok: true;
  requestId: string;
  url: string;
  plan: BillingPlan;
}

interface PortalResult {
  ok: true;
  requestId: string;
  url: string;
}

const createCheckoutCallable = httpsCallable<CreateCheckoutInput, CheckoutResult>(
  functions,
  "createCheckoutSessionV1",
);
const createPortalCallable = httpsCallable<CreateBillingPortalInput, PortalResult>(
  functions,
  "createBillingPortalSessionV1",
);

export async function startCheckout(input: CreateCheckoutInput): Promise<string> {
  const result = await createCheckoutCallable(input);
  return result.data.url;
}

export async function openBillingPortal(input: CreateBillingPortalInput): Promise<string> {
  const result = await createPortalCallable(input);
  return result.data.url;
}

export async function loadBillingInfo(orgId: string): Promise<BillingInfo | null> {
  const snapshot = await getDoc(doc(db, "organizations", orgId, "billing", "subscription"));
  if (!snapshot.exists()) return null;
  return snapshot.data() as BillingInfo;
}

const updatePricingCallable = httpsCallable<
  UpdatePlanPricingInput,
  { ok: true; requestId: string }
>(functions, "updatePlanPricingV1");
const askSurveyDataCallable = httpsCallable<AskSurveyDataInput, AskSurveyDataResult>(
  functions,
  "askSurveyDataV1",
);

/** Super-admin platform pricing override for Pro and Enterprise. */
export async function updatePlanPricing(input: UpdatePlanPricingInput): Promise<void> {
  await updatePricingCallable(input);
}

/** Reads the platform billing config with default amounts as fallback. */
export async function loadBillingConfig(): Promise<{ pro: number; enterprise: number }> {
  const snapshot = await getDoc(doc(db, "platform", "billingConfig"));
  const data = snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : {};
  return {
    pro: typeof data.pro === "number" ? data.pro : 49,
    enterprise: typeof data.enterprise === "number" ? data.enterprise : 199,
  };
}

/** Asks a natural-language question about a survey's aggregated results. */
export async function askSurveyData(input: AskSurveyDataInput): Promise<AskSurveyDataResult> {
  const result = await askSurveyDataCallable(input);
  return result.data;
}
