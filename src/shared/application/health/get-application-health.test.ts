import { describe, expect, it } from "vitest";
import { getApplicationHealth } from "./get-application-health";
import type { DatabaseHealthChecker } from "./database-health-checker.port";

function fakeChecker(isReachable: boolean): DatabaseHealthChecker {
  return {
    isReachable: async () => isReachable,
  };
}

describe("getApplicationHealth", () => {
  it("devuelve un snapshot saludable cuando el puerto informa conexión", async () => {
    const snapshot = await getApplicationHealth(fakeChecker(true));

    expect(snapshot).toEqual({ application: "ok", database: "connected" });
  });

  it("devuelve un estado controlado cuando el puerto informa fallo, sin lanzar", async () => {
    const snapshot = await getApplicationHealth(fakeChecker(false));

    expect(snapshot).toEqual({ application: "ok", database: "unavailable" });
  });

  it("no filtra detalles de la implementación si el puerto falla con una excepción", async () => {
    const failingChecker: DatabaseHealthChecker = {
      isReachable: async () => {
        throw new Error("credenciales inválidas en postgres://user:secret@host/db");
      },
    };

    await expect(getApplicationHealth(failingChecker)).rejects.toThrow();
    // El caso de uso no envuelve el error: es responsabilidad del adaptador de
    // infraestructura capturarlo y nunca dejarlo propagar con detalles sensibles.
  });
});
