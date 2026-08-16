import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("provides respondent and administrator routes", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /open demo survey/i })).toHaveAttribute(
      "href",
      "/s/demo-end-of-season",
    );
    expect(screen.getByRole("link", { name: /survey administration/i })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
