/**
 * Puerto (interfaz) que la capa de aplicación necesita para saber si la base
 * de datos responde. La implementación real (Prisma) vive en infraestructura;
 * aquí solo se declara el contrato, sin depender de ningún driver concreto.
 */
export interface DatabaseHealthChecker {
  isReachable(): Promise<boolean>;
}
