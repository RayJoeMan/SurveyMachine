import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type {
  BillingInfo,
  BillingPlan,
  CreateBillingPortalInput,
  CreateCheckoutInput,
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
