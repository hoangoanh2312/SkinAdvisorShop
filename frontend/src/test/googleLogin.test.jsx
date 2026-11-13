import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestGoogleCode: vi.fn(), loginWithGoogle: vi.fn(), login: vi.fn() }));
vi.mock("../utils/googleCodePopup", () => ({ requestGoogleCode: mocks.requestGoogleCode }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ login: mocks.login, loginWithGoogle: mocks.loginWithGoogle }) }));
import Login from "../pages/Login";

beforeEach(() => { vi.clearAllMocks(); });

it("opens Google account popup, submits only the authorization code, then uses existing navigation", async () => {
  mocks.requestGoogleCode.mockResolvedValue("one-time-code");
  mocks.loginWithGoogle.mockResolvedValue({ role: "customer" });
  render(<MemoryRouter initialEntries={["/login"]}><Routes><Route path="/login" element={<Login />} /><Route path="/profile" element={<div>Hồ sơ</div>} /></Routes></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Tiếp tục với Google" }));
  await screen.findByText("Hồ sơ");
  expect(mocks.requestGoogleCode).toHaveBeenCalledTimes(1);
  expect(mocks.loginWithGoogle).toHaveBeenCalledWith("one-time-code");
  expect(mocks.login).not.toHaveBeenCalled();
});

it("keeps email login available if the Google popup fails", async () => {
  mocks.requestGoogleCode.mockRejectedValue(new Error("GOOGLE_POPUP_CLOSED"));
  render(<MemoryRouter><Login /></MemoryRouter>);
  await userEvent.click(screen.getByRole("button", { name: "Tiếp tục với Google" }));
  await waitFor(() => expect(screen.getByText(/Không thể đăng nhập Google/)).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Đăng nhập" })).not.toBeDisabled();
});
