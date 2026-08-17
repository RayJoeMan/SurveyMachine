import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import type { BillingInfo, BillingPlan } from "@/contracts";
import { useAuth } from "@/auth/AuthProvider";
import { useActiveOrg } from "@/auth/OrgProvider";
import { AdminShell } from "@/modules/admin/components/AdminShell";
import {
  loadBillingInfo,
  openBillingPortal,
  startCheckout,
} from "@/modules/admin/data/billing.repository";
import { LoadingState } from "@/shared/AsyncState";

const PLAN_PRICING: Array<{ plan: BillingPlan; label: string; price: string; blurb: string }> = [
  {
    plan: "free",
    label: "Free",
    price: "$0",
    blurb: "Community use with a single published survey.",
  },
  {
    plan: "pro",
    label: "Pro",
    price: "$49/mo",
    blurb: "Unlimited surveys, exports, and standard support.",
  },
  {
    plan: "enterprise",
    label: "Enterprise",
    price: "$199/mo",
    blurb: "Everything in Pro plus priority onboarding and support.",
  },
];

function statusLabel(status: BillingInfo["status"] | undefined): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trialing";
    case "past_due":
      return "Past due";
    case "incomplete":
      return "Incomplete";
    case "canceled":
      return "Canceled";
    default:
      return "Free";
  }
}

export function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeOrgId, activeOrg, loading: orgLoading } = useActiveOrg();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<BillingPlan | "portal" | null>(null);

  const isOrgAdmin = Boolean(activeOrg?.roles.includes("org_admin"));
  const query = new URLSearchParams(window.location.search);
  const checkoutOutcome = query.get("status");

  const loadBilling = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      setBilling(await loadBillingInfo(activeOrgId));
    } catch (loadError) {
      console.error("Billing load failed", loadError);
      setError("Billing information could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadBilling();
    })();
  }, [loadBilling]);

  async function handleUpgrade(plan: BillingPlan) {
    if (!activeOrgId) return;
    setBusy(plan);
    setError("");
    try {
      const origin = window.location.origin;
      const url = await startCheckout({
        orgId: activeOrgId,
        plan,
        successUrl: `${origin}/admin/billing?status=success`,
        cancelUrl: `${origin}/admin/billing?status=canceled`,
      });
      window.location.assign(url);
    } catch (checkoutError) {
      console.error("Checkout failed", checkoutError);
      setError(
        checkoutError instanceof Error
          ? `Checkout could not be started: ${checkoutError.message}`
          : "Checkout could not be started.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleManageBilling() {
    if (!activeOrgId) return;
    setBusy("portal");
    setError("");
    try {
      const url = await openBillingPortal({
        orgId: activeOrgId,
        returnUrl: `${window.location.origin}/admin/billing`,
      });
      window.location.assign(url);
    } catch (portalError) {
      console.error("Billing portal failed", portalError);
      setError(
        portalError instanceof Error
          ? `The billing portal could not be opened: ${portalError.message}`
          : "The billing portal could not be opened.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (authLoading || orgLoading) return <LoadingState label="Loading billing…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!activeOrgId) return <Navigate to="/admin" replace />;

  const currentPlan = billing?.plan ?? "free";
  const hasSubscription =
    billing?.status === "active" ||
    billing?.status === "trialing" ||
    billing?.status === "past_due";

  return (
    <AdminShell>
      <div className="page">
        <h1>Billing</h1>
        <p className="muted">
          {activeOrg?.name ?? activeOrgId} · {statusLabel(billing?.status)}
          {billing?.currentPeriodEnd
            ? ` · renews ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`
            : ""}
        </p>

        {checkoutOutcome === "success" && (
          <p className="success-banner">
            Thanks — your subscription is being activated. This can take a moment.
          </p>
        )}
        {checkoutOutcome === "canceled" && (
          <p className="notice-banner">Checkout was canceled. No changes were made.</p>
        )}
        {error && <p className="error-banner">{error}</p>}

        {loading ? (
          <LoadingState label="Loading billing…" />
        ) : (
          <div className="billing-grid">
            {PLAN_PRICING.map((option) => {
              const isCurrent = currentPlan === option.plan;
              const disabled = busy !== null || (isCurrent && hasSubscription);
              return (
                <section key={option.plan} className={`plan-card${isCurrent ? " is-current" : ""}`}>
                  <h2>{option.label}</h2>
                  <p className="plan-price">{option.price}</p>
                  <p className="muted">{option.blurb}</p>
                  {isCurrent && <p className="plan-badge">Current plan</p>}
                  {option.plan !== "free" && isOrgAdmin && (
                    <button
                      type="button"
                      className="primary"
                      disabled={disabled}
                      onClick={() => void handleUpgrade(option.plan)}
                    >
                      {busy === option.plan
                        ? "Redirecting…"
                        : hasSubscription
                          ? "Switch plan"
                          : "Upgrade"}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {isOrgAdmin && hasSubscription && (
          <button
            type="button"
            className="secondary"
            disabled={busy !== null}
            onClick={() => void handleManageBilling()}
          >
            {busy === "portal" ? "Opening…" : "Manage billing"}
          </button>
        )}

        <p className="muted small">
          Payments are processed securely by Stripe. Subscriptions can be managed or canceled at any
          time from the billing portal; see our{" "}
          <a href="/legal/refunds">refund and cancellation policy</a>.
        </p>
      </div>
    </AdminShell>
  );
}
