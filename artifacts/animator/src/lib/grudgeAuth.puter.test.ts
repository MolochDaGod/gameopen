import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPuter = vi.fn();

vi.mock("../auth/grudgeAuth", () => ({
  signIn: signInWithPuter,
}));

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("registerWithPuter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.stubGlobal("sessionStorage", new MemoryStorage());
    vi.stubGlobal("window", {
      location: { hostname: "open.grudge-studio.com" },
    });
  });

  it("registers a Puter UUID and stores the returned Grudge session", async () => {
    signInWithPuter.mockResolvedValue({
      uuid: "puter-uuid-1",
      username: "RoadKing",
      email: "road@example.com",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        sessionToken: "fleet.jwt.token",
        grudgeId: "GRUDGE_123",
        username: "RoadKing",
        isNew: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getStoredAccount, getStoredToken, registerWithPuter } = await import("./grudgeAuth");
    const result = await registerWithPuter();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/puter",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          puterUuid: "puter-uuid-1",
          puterId: "puter-uuid-1",
          puterUsername: "RoadKing",
          displayName: "RoadKing",
          email: "road@example.com",
        }),
      }),
    );
    expect(result?.isNew).toBe(true);
    expect(getStoredToken()).toBe("fleet.jwt.token");
    expect(getStoredAccount()).toEqual({
      grudgeId: "GRUDGE_123",
      displayName: "RoadKing",
      source: "grudge-id",
    });
  });

  it("does not establish a fake session from a temporary Puter account", async () => {
    signInWithPuter.mockResolvedValue({
      uuid: "guest_123",
      username: "Guest",
      is_temp: true,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getStoredToken, registerWithPuter } = await import("./grudgeAuth");
    await expect(registerWithPuter()).rejects.toThrow("Temporary Puter accounts");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getStoredToken()).toBeNull();
  });
});