import { buildHealthSnapshot, type HealthSnapshot } from "@/shared/domain/health/health-snapshot";
import type { DatabaseHealthChecker } from "./database-health-checker.port";

/**
 * Caso de uso: obtiene el estado de salud de la aplicación consultando el
 * puerto de base de datos y delegando la interpretación del resultado en el
 * dominio. No conoce Prisma ni ningún detalle de infraestructura.
 */
export async function getApplicationHealth(
  databaseHealthChecker: DatabaseHealthChecker,
): Promise<HealthSnapshot> {
  const isDatabaseReachable = await databaseHealthChecker.isReachable();

  return buildHealthSnapshot(isDatabaseReachable);
}
