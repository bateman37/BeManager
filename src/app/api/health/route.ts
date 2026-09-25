import { NextResponse } from "next/server";
import { getApplicationHealth } from "@/shared/application/health/get-application-health";
import { PrismaDatabaseHealthChecker } from "@/shared/infrastructure/db/prisma-database-health-checker";

// No debe evaluarse en tiempo de build: la comprobación de PostgreSQL solo
// tiene sentido en tiempo de petición.
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getApplicationHealth(new PrismaDatabaseHealthChecker());
  const status = health.database === "connected" ? 200 : 503;

  return NextResponse.json(health, { status });
}
