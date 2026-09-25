import { describe, expect, it, vi, beforeEach } from "vitest";

const queryRawMock = vi.fn();

vi.mock("./prisma-client", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
  },
}));

describe("PrismaDatabaseHealthChecker", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it("devuelve true cuando la consulta SELECT 1 se ejecuta correctamente", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);
    const { PrismaDatabaseHealthChecker } = await import("./prisma-database-health-checker");

    const isReachable = await new PrismaDatabaseHealthChecker().isReachable();

    expect(isReachable).toBe(true);
  });

  it("captura cualquier error de conexión y devuelve false sin propagarlo", async () => {
    queryRawMock.mockRejectedValueOnce(
      new Error("could not connect to server: postgres://user:s3cret@db:5432"),
    );
    const { PrismaDatabaseHealthChecker } = await import("./prisma-database-health-checker");

    await expect(new PrismaDatabaseHealthChecker().isReachable()).resolves.toBe(false);
  });
});
