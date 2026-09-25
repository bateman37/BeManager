import { describe, expect, it } from "vitest";
import { buildHealthSnapshot, isFullyHealthy } from "./health-snapshot";

describe("buildHealthSnapshot", () => {
  it("reporta la base de datos como conectada cuando es alcanzable", () => {
    const snapshot = buildHealthSnapshot(true);

    expect(snapshot).toEqual({ application: "ok", database: "connected" });
  });

  it("reporta la base de datos como no disponible cuando no es alcanzable", () => {
    const snapshot = buildHealthSnapshot(false);

    expect(snapshot).toEqual({ application: "ok", database: "unavailable" });
  });
});

describe("isFullyHealthy", () => {
  it("es verdadero solo cuando la base de datos está conectada", () => {
    expect(isFullyHealthy(buildHealthSnapshot(true))).toBe(true);
    expect(isFullyHealthy(buildHealthSnapshot(false))).toBe(false);
  });
});
