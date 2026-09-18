import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();

vi.mock("./grudgeAuth", () => ({
  apiFetch,
  getStoredToken: () => "fleet.jwt.token",
}));

describe("updateAccountUsername", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates display metadata without sending immutable identity fields", async () => {
    apiFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ displayName: "RoadKing" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "account-1",
          grudgeId: "GRUDGE_123",
          displayName: "RoadKing",
        }),
      });

    const { updateAccountUsername } = await import("./accountShared");
    const profile = await updateAccountUsername(" RoadKing ");

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      "/api/account",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ username: "RoadKing", displayName: "RoadKing" }),
      }),
    );
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).not.toHaveProperty("grudgeId");
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).not.toHaveProperty("puterUuid");
    expect(profile.displayName).toBe("RoadKing");
  });

  it("rejects invalid usernames before calling Railway", async () => {
    const { updateAccountUsername } = await import("./accountShared");
    await expect(updateAccountUsername("x")).rejects.toThrow("at least 2");
    expect(apiFetch).not.toHaveBeenCalled();
  });
});