import type { DatabaseHealthChecker } from "@/shared/application/health/database-health-checker.port";
import { prisma } from "./prisma-client";

/**
 * Adaptador de infraestructura: comprueba la conexión a PostgreSQL con la
 * operación mínima equivalente a `SELECT 1`. Cualquier error de conexión se
 * captura aquí y se traduce a `false`; nunca se propaga el error original
 * para evitar filtrar cadenas de conexión, credenciales o detalles internos
 * hacia la UI o la API.
 */
export class PrismaDatabaseHealthChecker implements DatabaseHealthChecker {
  async isReachable(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error("[health] La comprobación de PostgreSQL ha fallado.", error);
      return false;
    }
  }
}
