import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

const sendPasswordReset = vi.fn();

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ sendPasswordReset }),
}));

beforeEach(() => {
  sendPasswordReset.mockReset();
  sendPasswordReset.mockResolvedValue(undefined);
});

describe("ForgotPasswordPage", () => {
  it("requests a reset link for the entered email", async () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/email/i), "admin@example.test");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(sendPasswordReset).toHaveBeenCalledWith("admin@example.test");
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("shows an error when the request fails", async () => {
    sendPasswordReset.mockRejectedValue(new Error("no account"));
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/email/i), "missing@example.test");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});
