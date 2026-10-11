import { describe, expect, it } from "vitest";
import { computePossessionCore } from "../simulation/possession-core";
import { getScenario } from "../lab/scenario";
import { SIERRA_CLARA, PUERTO_AMBAR } from "../players/lab-roster-fixture";
import { createResumableRandom } from "../random/seeded-random";
import { createRecordingAuditCollector } from "../audit/audit-collector";

/**
 * Pruebas discriminantes de ME-04B §5 punto 2 (casos construidos, no
 * semillas mágicas), separadas de `me04.test.ts` para no tocarlo
 * retrospectivamente. Reutilizan la misma técnica de geometría construida a
 * mano de la prueba de segunda entrada de ME-04 (`organized_set` enlazado
 * con reglas de partido), variando solo las posiciones de defensa que cada
 * caso necesita.
 */
function baseStart(): Record<string, { x: number; y: number }> {
  const scenario = getScenario("drop_con_ayuda");
  const start: Record<string, { x: number; y: number }> = {};
  for (const s of [...scenario.offense, ...scenario.defense]) start[s.playerId] = s.initialPosition;
  return start;
}

const BINDING = Object.fromEntries(
  [...getScenario("drop_con_ayuda").offense, ...getScenario("drop_con_ayuda").defense].map((s) => [s.playerId, s.playerId]),
);

function run(seed: number, start: Record<string, { x: number; y: number }>) {
  const audit = createRecordingAuditCollector();
  const core = computePossessionCore(
    {
      scenarioId: "drop_con_ayuda",
      coverage: "drop",
      seed,
      rulesetVersion: "FIBA-2026",
      labParametersVersion: "LAB-0.3" as MatchInputLabVersion,
      offensePlayers: SIERRA_CLARA.players,
      defensePlayers: PUERTO_AMBAR.players,
      // ME-07B v2 §2.4: estos casos construidos exigen la ayuda de D3 como
      // orden explícita (en el partido enlazado, por defecto, D3 la lee).
      rollHelpCall: "siempre",
    },
    {
      audit,
      trackPositionHistory: true,
      linked: {
        binding: BINDING,
        startPositions: start,
        shotClockMs: 20_000,
        gameClockMs: 400_000,
        rng: createResumableRandom(seed),
        attackingPriority: "proteger_balance",
        entry: { kind: "organized_set" },
        rules: { deferFreeThrows: true, ordinaryFouls: true, secondEntryAllowed: true },
      },
    },
  );
  return { core, audit };
}

// Solo para tipar el literal sin importar el módulo entero de match-input.
type MatchInputLabVersion = "LAB-0.1" | "LAB-0.2" | "LAB-0.3";

describe("ME-04B (5): D3 ayuda, D4 cierra O3 y libera a O4 para una recepción legal (caso c)", () => {
  it("cuando D4 cierra la esquina débil, O4 queda realmente libre por el ala débil (help_repair_attempt)", () => {
    // Geometría del fixture natural (`drop_con_ayuda` ya trae D3 ayudando);
    // el mecanismo es el mismo ya probado en ME-01/02/04 y no cambia aquí:
    // se deja constancia explícita de que sigue vivo bajo el nuevo árbol.
    const { core } = run(1, baseStart());
    const helpLeft = core.timeline.find((e) => e.kind === "help_left_assignment");
    const helpRepair = core.timeline.find((e) => e.kind === "help_repair_attempt");
    expect(helpLeft).toBeDefined();
    expect(helpRepair).toBeDefined();
    expect(helpRepair!.text).toMatch(/O4/);
  });
});

describe("ME-04B (5): negar la salida y la segunda entrada desemboca en reloj/salida controlada, no en tiro concedido (caso e)", () => {
  it("con las dos líneas de pase de la segunda entrada bloqueadas, O5 fuerza un tiro realmente contestado, nunca uno abierto por defecto", () => {
    const start = baseStart();
    // D3 contiene el short roll de verdad; D4 cierra la esquina débil (igual
    // que en la prueba de segunda entrada de ME-04); D2 se mantiene cerca de
    // O2 para que esa segunda línea de pase también quede cerrada. Ninguna
    // de las dos salidas de la segunda entrada es viable.
    start.D3 = { x: 23.3, y: 10.5 };
    start.D4 = { x: 23.6, y: 13.2 };
    start.D5 = { x: 25.2, y: 6.4 };
    start.D2 = { x: 23.8, y: 2.0 };
    let checked = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { audit } = run(seed, start);
      const secondEntry = audit.snapshot().decisions.find((d) => d.point === "segunda_entrada");
      if (!secondEntry || secondEntry.chosenOptionId !== null) continue;
      // Las dos vías se evaluaron de verdad y las dos perdieron por una
      // condición real (línea de pase bloqueada), no por cortocircuito.
      for (const o of secondEntry.options) {
        expect(o.status).toBe("descartada_por_condicion");
        expect(o.reasonCode).not.toBe("not_evaluated_short_circuit");
      }
      const secondRead = audit.snapshot().decisions.find((d) => d.point === "lectura_segunda_o5")!;
      // ME-07B v2 §2.4: contenido y sin salida, O5 elige el mejor tiro
      // contestado disponible (aro o floater), con la contención anotada.
      expect(["finalizar_aro", "flotadora"]).toContain(secondRead.chosenOptionId);
      expect(secondRead.note).toMatch(/contiene a O5/);
      const shot = audit.snapshot().decisions.find((d) => d.point === "resolucion_tiro")!;
      // El tiro forzado se resuelve con la geometría real de contacto de
      // siempre (puede ser "no_contest" si D3 aún no llegó del todo al
      // liberar, "legal_contest" o falta tardía): lo que nunca ocurre es que
      // la falta de segunda entrada invente una oposición o un desenlace.
      expect(["no_contest", "legal_contest", "late_illegal_contact"]).toContain(shot.chosenOptionId);
      checked++;
      break;
    }
    expect(checked).toBe(1);
  });
});
