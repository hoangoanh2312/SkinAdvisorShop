import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../api/axiosClient", () => ({ default: mocks }));
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function Probe() {
  const { user, loading, logout } = useAuth();
  return <div><span>{loading ? "loading" : user?.email || "signed-out"}</span><button onClick={logout}>logout</button></div>;
}

beforeEach(() => { localStorage.clear(); mocks.get.mockReset(); });

it("logout clears the authenticated user and persisted session", async () => {
  localStorage.setItem("skinora_token", "token");
  localStorage.setItem("skinora_user", JSON.stringify({ email: "admin@example.com" }));
  mocks.get.mockResolvedValue({ data: { data: { user: { email: "admin@example.com", role: "admin" } } } });
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText("admin@example.com");
  await userEvent.click(screen.getByRole("button", { name: "logout" }));
  await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
  expect(localStorage.getItem("skinora_token")).toBeNull();
  expect(localStorage.getItem("skinora_user")).toBeNull();
});
