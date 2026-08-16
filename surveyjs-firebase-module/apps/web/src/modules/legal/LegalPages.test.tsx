import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyPolicy, RefundsAndCancellations, TermsOfService } from "./LegalPages";

describe("legal pages", () => {
  it("renders the Terms of Service with a youth-data disclaimer", () => {
    render(<TermsOfService />);
    expect(screen.getByRole("heading", { name: /terms of service/i })).toBeTruthy();
    expect(screen.getByText(/children under 13/i)).toBeTruthy();
  });

  it("renders the Privacy Policy including COPPA and deletion guidance", () => {
    render(<PrivacyPolicy />);
    expect(screen.getByRole("heading", { name: /privacy policy/i })).toBeTruthy();
    expect(screen.getByText(/COPPA/i)).toBeTruthy();
    expect(screen.getByText(/delete a survey/i)).toBeTruthy();
  });

  it("renders refunds and cancellations", () => {
    render(<RefundsAndCancellations />);
    expect(screen.getByRole("heading", { name: /refunds & cancellations/i })).toBeTruthy();
    expect(screen.getByText(/14 days/i)).toBeTruthy();
  });
});
