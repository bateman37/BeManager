/**
 * Reglas puras de dominio para determinar el estado de salud visible de la
 * aplicación. No depende de Next.js, Prisma ni de ningún detalle de
 * infraestructura: solo combina hechos ya observados en un resultado
 * consistente y reutilizable por la UI y por el endpoint de salud.
 */

export type DatabaseHealthState = "connected" | "unavailable";

export interface HealthSnapshot {
  readonly application: "ok";
  readonly database: DatabaseHealthState;
}

export function buildHealthSnapshot(isDatabaseReachable: boolean): HealthSnapshot {
  return {
    application: "ok",
    database: isDatabaseReachable ? "connected" : "unavailable",
  };
}

export function isFullyHealthy(snapshot: HealthSnapshot): boolean {
  return snapshot.database === "connected";
}
