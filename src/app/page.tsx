import { getApplicationHealth } from "@/shared/application/health/get-application-health";
import { PrismaDatabaseHealthChecker } from "@/shared/infrastructure/db/prisma-database-health-checker";
import { StatusBadge } from "@/shared/ui/status-badge";

// Evita que Next.js intente conectarse a PostgreSQL durante `next build`:
// esta página se renderiza siempre en tiempo de petición.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const health = await getApplicationHealth(new PrismaDatabaseHealthChecker());
  const isDatabaseConnected = health.database === "connected";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Fase Foundation
        </p>
        <h1 className="text-4xl font-bold tracking-tight">BeManager</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Esta es una interfaz provisional. Todavía no representa el diseño
          visual definitivo del juego.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold">Estado de la aplicación</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-slate-500 dark:text-slate-400">Aplicación</dt>
            <dd>
              <StatusBadge label="En ejecución" tone="positive" />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-slate-500 dark:text-slate-400">PostgreSQL</dt>
            <dd>
              {isDatabaseConnected ? (
                <StatusBadge label="Conectado" tone="positive" />
              ) : (
                <StatusBadge label="No disponible" tone="negative" />
              )}
            </dd>
          </div>
        </dl>
        {!isDatabaseConnected && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No se ha podido comprobar la conexión con la base de datos. Revisa
            tu configuración local en <code>.env</code>. Este mensaje no
            muestra credenciales ni detalles internos.
          </p>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-dashed border-slate-300 p-6 dark:border-slate-700">
        <h2 className="text-lg font-semibold">Próximo bloque</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          El siguiente gran bloque de trabajo será el diseño integrado del
          motor de partido, las tácticas y los atributos como un único
          núcleo de juego.
        </p>
      </section>
    </main>
  );
}
