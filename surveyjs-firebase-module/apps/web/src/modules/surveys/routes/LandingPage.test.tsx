import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("exposes entry points and legal links", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /feedback that builds better programs/i }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /terms of service/i })).toHaveAttribute(
      "href",
      "/legal/terms",
    );
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
    // The demo survey entry is present in development/test environments.
    expect(screen.getByRole("link", { name: /open demo survey/i })).toHaveAttribute(
      "href",
      "/s/demo-end-of-season",
    );
  });
});
