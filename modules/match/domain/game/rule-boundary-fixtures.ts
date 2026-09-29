/**
 * Casos de frontera reglamentarios de ME-04 §7, **no partidos reales**:
 * cada caso parte de un estado y unos hechos de entrada explícitos,
 * declarados aquí como fixture de prueba, y los pasa por **las mismas
 * funciones puras** que usa el partido (`fiba-2026-rules.ts`,
 * `awardFreeThrowsForShootingFoul`, `projectBoxScore`). No existe un
 * segundo reglamento para la demostración, y nada de esto se inserta en el
 * acta de un partido normal.
 */
import type { Milliseconds } from "../time/clock";
import { awardFreeThrowsForShootingFoul } from "../simulation/resolvers/foul-resolver";
import type { FactKind } from "../simulation/fact";
import type { TramoEvent } from "../sequence/tramo-model";
import {
  FIBA_2026,
  adjudicateBuzzerShot,
  adjudicateDefensiveFoul,
  adjudicatePeriodEnd,
  attackDirectionForPeriod,
  gameClockStopsOnMadeBasket,
  periodLabel,
  shotClockAfterDefensiveFoulThrowIn,
  substitutionOpportunity,
  teamFoulPeriodKey,
} from "./fiba-2026-rules";
import { projectBoxScore } from "./box-score";

export const RULE_BOUNDARY_LABEL = "Caso de frontera reglamentario (fixture de prueba, no es un partido)";

export interface RuleBoundaryStep {
  /** Período del estado de entrada (1–4; 5+ prórrogas). */
  readonly period: number;
  /** Reloj de partido del estado de entrada, ms. */
  readonly gameClockMs: Milliseconds;
  readonly label: string;
  /** Estado y hechos de entrada, explícitos. */
  readonly input: Readonly<Record<string, unknown>>;
  /** Función pura que adjudica este paso (la misma del partido). */
  readonly rule: string;
  /** Resultado devuelto por esa función. */
  readonly output: Readonly<Record<string, unknown>>;
  /** Lectura en español del resultado. */
  readonly verdict: string;
}

export interface RuleBoundaryCase {
  readonly id: "bocina" | "reset_falta_sin_tiro" | "falta_tiro_and_one" | "bonus_y_quinta" | "prorrogas" | "canasta_c4_dos_minutos";
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly RuleBoundaryStep[];
}

const HOME = "sierra-clara";
const AWAY = "puerto-ambar";
const TEAMS = [HOME, AWAY] as const;

function clock(ms: number): string {
  const tenths = Math.floor(ms / 100);
  return `${Math.floor(tenths / 600)}:${String(Math.floor((tenths % 600) / 10)).padStart(2, "0")}.${tenths % 10}`;
}

// --- (a) bocina -------------------------------------------------------------------

function buzzerCase(): RuleBoundaryCase {
  const buzzerMs = 606_740;
  const rows = [
    { label: "Triple soltado 1 ms antes de la bocina, entra con el balón en el aire", releaseMs: buzzerMs - 1, made: true },
    { label: "Triple soltado justo en el milisegundo de la bocina", releaseMs: buzzerMs, made: true },
    { label: "Triple soltado 1 ms después de la bocina", releaseMs: buzzerMs + 1, made: true },
    { label: "Tiro de dos soltado 0,3 s antes, falla y el balón queda suelto tras la bocina", releaseMs: buzzerMs - 300, made: false },
  ];
  return {
    id: "bocina",
    title: "(a) Lanzamiento antes, en y después de la bocina",
    summary: "Un tiro soltado antes de la señal puede seguir en el aire y contar; soltado en la señal o después no cuenta ni es FGA. Un fallo final sin control no genera rebote.",
    steps: rows.map((row) => {
      const out = adjudicateBuzzerShot({ releaseMs: row.releaseMs, buzzerMs, made: row.made, shotPoints: row.made ? 3 : 2 });
      return {
        period: 1,
        gameClockMs: 0,
        label: row.label,
        input: { releaseMs: row.releaseMs, buzzerMs, made: row.made },
        rule: "adjudicateBuzzerShot / isReleasedBeforeBuzzer",
        output: { ...out },
        verdict: out.releasedInTime
          ? `Soltado a tiempo: FGA${out.pointsAwarded > 0 ? ` y ${out.pointsAwarded} puntos` : " sin puntos"}; ${row.made ? "cuenta aunque entre tras la bocina" : "no hay rebote: el período ya terminó"}.`
          : "Soltado en o tras la señal: no cuenta ni se registra FGA.",
      };
    }),
  };
}

// --- (b) reset del reloj de lanzamiento por falta sin tiro --------------------------

function shotClockResetCase(): RuleBoundaryCase {
  const rows = [
    { label: "Falta sin tiro (sin bonus), saque en pista delantera con 13,0 s", front: true, remaining: 13_000 },
    { label: "Ídem con 13,999 s (todavía «13 s o menos»)", front: true, remaining: 13_999 },
    { label: "Ídem con 14,000 s exactos", front: true, remaining: 14_000 },
    { label: "Ídem con 18,4 s", front: true, remaining: 18_400 },
    { label: "Falta sin tiro con saque en pista trasera, 9,2 s restantes", front: false, remaining: 9_200 },
  ];
  return {
    id: "reset_falta_sin_tiro",
    title: "(b) Reset del reloj de lanzamiento tras falta sin tiro (art. 29)",
    summary: "Pista trasera: 24 s. Pista delantera: se conserva con 14 s o más; con 13 s o menos pasa a 14 s. Distinto del balón fuera de ME-03, que conserva el reloj.",
    steps: rows.map((row) => {
      const shotClockMs = shotClockAfterDefensiveFoulThrowIn({ inThrowingTeamFrontcourt: row.front, remainingMs: row.remaining });
      return {
        period: 2,
        gameClockMs: 431_200,
        label: row.label,
        input: { inThrowingTeamFrontcourt: row.front, remainingMs: row.remaining },
        rule: "shotClockAfterDefensiveFoulThrowIn",
        output: { shotClockMs },
        verdict: `Reloj de lanzamiento al tocar el saque: ${(shotClockMs / 1000).toFixed(3).replace(".", ",")} s.`,
      };
    }),
  };
}

// --- (c) falta de tiro y and-one, con su acta ------------------------------------------

interface FixtureFact {
  readonly kind: FactKind;
  readonly actors: readonly string[];
  readonly detail?: Readonly<Record<string, unknown>>;
}

/** Hechos mínimos de entrada con sus diez en pista, para proyectar el acta con la función del partido. */
function fixtureEvents(possessionTeamId: string, facts: readonly FixtureFact[]): TramoEvent[] {
  const onCourtIds = ["D1", "D2", "D3", "D4", "D5", "O1", "O2", "O3", "O4", "O5"];
  return facts.map((f, i) => ({
    sequence: i,
    atMs: 1_000 * i,
    possessionIndex: 1,
    phaseIndex: 1,
    possessionTeamId,
    phase: "concedido",
    kind: f.kind,
    actors: f.actors,
    text: "",
    detail: f.detail ?? {},
    positions: [],
    ball: { status: "dead", holderId: null, position: { x: 14, y: 7.5 } },
    control: { status: "balon_muerto", controlTeamId: null, throwInTeamId: null },
    gameClockMs: 300_000,
    shotClockMs: null,
    score: {},
    period: 3,
    onCourtIds,
  }));
}

const FIXTURE_ROSTERS = [
  { teamId: HOME, playerIds: ["O1", "O2", "O3", "O4", "O5"] },
  { teamId: AWAY, playerIds: ["D1", "D2", "D3", "D4", "D5"] },
];

function andOneCase(): RuleBoundaryCase {
  const steps: RuleBoundaryStep[] = [];
  const scenarios = [
    {
      label: "O1 pasa a O5 en el roll; O5 anota de dos con falta de D3 y convierte el libre (and-one)",
      shotType: "close_finish" as const,
      made: true,
      teamFoulsBefore: 6,
      facts: [
        { kind: "pass_released" as const, actors: ["O1", "O5"] },
        { kind: "pass_received" as const, actors: ["O5"] },
        { kind: "shot_prepared" as const, actors: ["O5"] },
        { kind: "field_goal_attempt" as const, actors: ["O5"], detail: { shotType: "close_finish", made: true, points: 2 } },
        { kind: "shooting_foul" as const, actors: ["O5"], detail: { madeShot: true, freeThrows: 1 } },
        { kind: "personal_foul" as const, actors: ["D3", "O5"] },
        { kind: "free_throws_result" as const, actors: ["O5"], detail: { made: true, index: 1, of: 1 } },
      ],
    },
    {
      label: "O3 recibe en la esquina y falla el triple con falta de D4: tres libres, anota uno",
      shotType: "three_point" as const,
      made: false,
      teamFoulsBefore: 2,
      facts: [
        { kind: "pass_released" as const, actors: ["O5", "O3"] },
        { kind: "pass_received" as const, actors: ["O3"] },
        { kind: "shot_prepared" as const, actors: ["O3"] },
        { kind: "shooting_foul" as const, actors: ["O3"], detail: { madeShot: false, freeThrows: 3 } },
        { kind: "personal_foul" as const, actors: ["D4", "O3"] },
        { kind: "free_throws_result" as const, actors: ["O3"], detail: { made: false, index: 1, of: 3 } },
        { kind: "free_throws_result" as const, actors: ["O3"], detail: { made: true, index: 2, of: 3 } },
        { kind: "free_throws_result" as const, actors: ["O3"], detail: { made: false, index: 3, of: 3 } },
      ],
    },
  ];
  for (const sc of scenarios) {
    const award = awardFreeThrowsForShootingFoul(sc.shotType, sc.made);
    const adj = adjudicateDefensiveFoul(FIBA_2026, {
      type: "tiro",
      shotType: sc.shotType,
      madeShot: sc.made,
      teamFoulsInPeriodBefore: sc.teamFoulsBefore,
      foulerPersonalFoulsBefore: 1,
    });
    const box = projectBoxScore(fixtureEvents(HOME, sc.facts), FIXTURE_ROSTERS);
    const shooter = sc.facts.find((f) => f.kind === "shot_prepared")!.actors[0]!;
    const passer = sc.facts[0]!.actors[0]!;
    const line = box.players[shooter]!;
    steps.push({
      period: 3,
      gameClockMs: 300_000,
      label: sc.label,
      input: { shotType: sc.shotType, madeShot: sc.made, teamFoulsInPeriodBefore: sc.teamFoulsBefore, facts: sc.facts.map((f) => f.kind) },
      rule: "awardFreeThrowsForShootingFoul + adjudicateDefensiveFoul + projectBoxScore",
      output: {
        freeThrows: award.count,
        basketCounted: award.basketCounted,
        sanction: adj.sanction,
        teamInPenalty: adj.teamInPenalty,
        shooterLine: { fga: line.fga2 + line.fga3, fgm: line.fgm2 + line.fgm3, fta: line.fta, ftm: line.ftm, points: line.points },
        passerAssists: box.players[passer]!.ast,
      },
      verdict: `${award.count} libre(s)${award.basketCounted ? " y canasta válida" : ""}${adj.teamInPenalty ? " (el bonus no cambia la sanción de una falta de tiro)" : ""}. Acta del tirador: ${line.fgm2 + line.fgm3}/${line.fga2 + line.fga3} TC, ${line.ftm}/${line.fta} TL, ${line.points} puntos; asistencia de ${passer}: ${box.players[passer]!.ast}.`,
    });
  }
  return {
    id: "falta_tiro_and_one",
    title: "(c) Falta de tiro y and-one",
    summary: "La falta de tiro mantiene 1/2/3 libres con o sin bonus. And-one: 1 FGA y 1 FGM más un libre; tiro fallado con falta: sin FGA. La asistencia solo existe si el tirador convierte canasta o al menos un libre tras el pase.",
    steps,
  };
}

// --- (d) cuarta y quinta falta de equipo, bonus y quinta personal ------------------------

function bonusCase(): RuleBoundaryCase {
  const steps: RuleBoundaryStep[] = [];
  const clocks = [540_000, 470_300, 402_100, 333_900, 281_600, 190_000];
  const foulers = ["D2", "D1", "D4", "D2", "D3", "D1"];
  const personalBefore: Record<string, number> = { D1: 1, D2: 0, D3: 4, D4: 2 };
  let teamFouls = 0;
  foulers.forEach((fouler, i) => {
    const before = teamFouls;
    const adj = adjudicateDefensiveFoul(FIBA_2026, {
      type: "sin_tiro",
      teamFoulsInPeriodBefore: before,
      foulerPersonalFoulsBefore: personalBefore[fouler]!,
    });
    personalBefore[fouler] = adj.personalFoulsAfter;
    teamFouls = adj.teamFoulsAfter;
    steps.push({
      period: 1,
      gameClockMs: clocks[i]!,
      label: `Falta sin tiro n.º ${i + 1} de Puerto Ámbar en C1 (${fouler}, que llevaba ${adj.personalFoulsAfter - 1})`,
      input: { type: "sin_tiro", teamFoulsInPeriodBefore: before, foulerPersonalFoulsBefore: adj.personalFoulsAfter - 1 },
      rule: "adjudicateDefensiveFoul",
      output: { ...adj },
      verdict: `${adj.teamFoulsAfter}.ª falta de equipo: ${adj.sanction.kind === "saque" ? "saque" : `${adj.sanction.count} libres por bonus`}. ${fouler}: ${adj.personalFoulsAfter} personales${adj.disqualified ? " → excluido, sustitución obligatoria antes de reanudar" : ""}.`,
    });
  });
  // Las prórrogas cuentan en el contador de C4.
  const otKey = teamFoulPeriodKey(FIBA_2026, 5);
  const otAdj = adjudicateDefensiveFoul(FIBA_2026, { type: "sin_tiro", teamFoulsInPeriodBefore: 4, foulerPersonalFoulsBefore: 2 });
  steps.push({
    period: 5,
    gameClockMs: 250_000,
    label: "Primera falta sin tiro de la prórroga 1 con cuatro faltas de equipo ya cometidas en C4",
    input: { period: 5, teamFoulKey: otKey, teamFoulsInPeriodBefore: 4 },
    rule: "teamFoulPeriodKey + adjudicateDefensiveFoul",
    output: { teamFoulKey: otKey, ...otAdj },
    verdict: `El contador de la prórroga es el de C4 (clave ${otKey}): quinta falta de equipo, ${otAdj.sanction.kind === "libres" ? "dos libres por bonus" : "saque"}.`,
  });
  return {
    id: "bonus_y_quinta",
    title: "(d) Cuarta y quinta falta de equipo, bonus y quinta personal",
    summary: "Cada falta suma una al autor y una al equipo. Tras cuatro faltas de equipo en el cuarto, la siguiente sin tiro da dos libres. La quinta personal excluye al jugador. Las prórrogas acumulan sobre C4.",
    steps,
  };
}

// --- (e) empate al final de C4, prórroga y otra prórroga --------------------------------------

function overtimeCase(): RuleBoundaryCase {
  const ends = [
    { period: 4, home: 88, away: 88 },
    { period: 5, home: 96, away: 96 },
    { period: 6, home: 103, away: 101 },
  ];
  return {
    id: "prorrogas",
    title: "(e) Empate al acabar C4 → prórroga; empate en la prórroga → otra",
    summary: "Al final de C4 o de una prórroga, un empate lleva a otra prórroga de 5:00; solo sin empate hay final. Las prórrogas conservan las canastas de C4.",
    steps: ends.map((end) => {
      const decision = adjudicatePeriodEnd(FIBA_2026, end.period, [
        { teamId: HOME, points: end.home },
        { teamId: AWAY, points: end.away },
      ]);
      const next = decision.kind === "siguiente_periodo" ? decision.nextPeriod : null;
      return {
        period: end.period,
        gameClockMs: 0,
        label: `Bocina de ${periodLabel(FIBA_2026, end.period)} con ${end.home}–${end.away}`,
        input: { period: end.period, score: { [HOME]: end.home, [AWAY]: end.away } },
        rule: "adjudicatePeriodEnd + attackDirectionForPeriod",
        output: {
          ...decision,
          ...(next ? { nextPeriodDirectionHome: attackDirectionForPeriod(FIBA_2026, 0, next), c4DirectionHome: attackDirectionForPeriod(FIBA_2026, 0, 4) } : {}),
        },
        verdict:
          decision.kind === "final"
            ? `Final: gana ${decision.winnerTeamId === HOME ? "Sierra Clara" : "Puerto Ámbar"} (${decision.reason}).`
            : `Se juega ${periodLabel(FIBA_2026, decision.nextPeriod)} (5:00): ${decision.reason}.`,
      };
    }),
  };
}

// --- (f) canasta en C4 a 2:00 con oportunidad del equipo que encaja ----------------------------

function lastMinutesCase(): RuleBoundaryCase {
  const rows = [
    { period: 4, clockMs: 120_000, label: "Canasta de Sierra Clara en C4 con 2:00,0 exactos" },
    { period: 4, clockMs: 120_100, label: "Canasta de Sierra Clara en C4 con 2:00,1" },
    { period: 3, clockMs: 60_000, label: "Canasta de Sierra Clara en C3 con 1:00" },
    { period: 5, clockMs: 90_000, label: "Canasta de Sierra Clara en la prórroga 1 con 1:30" },
  ];
  return {
    id: "canasta_c4_dos_minutos",
    title: "(f) Canasta en C4 a 2:00 y sustitución del equipo que encaja",
    summary: "Desde 2:00 o menos de C4 y de cada prórroga la canasta detiene el reloj hasta el toque del saque, y solo el equipo que la recibe tiene oportunidad de sustitución. Antes, el reloj sigue y nadie sustituye.",
    steps: rows.map((row) => {
      const stops = gameClockStopsOnMadeBasket(FIBA_2026, row.period, row.clockMs);
      const teams = substitutionOpportunity({ cause: "canasta", gameClockStopped: stops, receivingTeamId: AWAY, teamIds: TEAMS });
      return {
        period: row.period,
        gameClockMs: row.clockMs,
        label: row.label,
        input: { period: row.period, gameClockMs: row.clockMs, scoringTeam: HOME, receivingTeam: AWAY },
        rule: "gameClockStopsOnMadeBasket + substitutionOpportunity",
        output: { gameClockStops: stops, substitutionTeams: teams },
        verdict: `${stops ? "El reloj se detiene hasta el toque legal del saque" : "El reloj sigue corriendo"} (${clock(row.clockMs)} en ${periodLabel(FIBA_2026, row.period)}); ${teams.length > 0 ? "puede sustituir solo Puerto Ámbar (el equipo que encaja)" : "no hay oportunidad de sustitución"}.`,
      };
    }),
  };
}

/** Los seis casos de frontera de ME-04 §7, construidos con las funciones puras del partido. */
export function buildRuleBoundaryCases(): readonly RuleBoundaryCase[] {
  return [buzzerCase(), shotClockResetCase(), andOneCase(), bonusCase(), overtimeCase(), lastMinutesCase()];
}
