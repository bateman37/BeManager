"use client";

import { useState } from "react";
import type { Fact } from "@match/domain/simulation/fact";

interface NarrativeLogProps {
  readonly facts: readonly Fact[];
  readonly onSelectPositions: (positions: Fact["positions"] | null) => void;
}

const PHASE_LABELS: Record<Fact["phase"], string> = {
  ordenado: "Ordenado",
  reconocido: "Reconocido",
  intentado: "Intentado",
  ejecutado: "Ejecutado",
  concedido: "Concedido",
};

export function NarrativeLog({ facts, onSelectPositions }: NarrativeLogProps) {
  const [revealedCount, setRevealedCount] = useState(Math.min(1, facts.length));
  const [selected, setSelected] = useState<number | null>(null);

  const visible = facts.slice(0, revealedCount);
  const canAdvance = revealedCount < facts.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canAdvance}
          onClick={() => setRevealedCount((n) => Math.min(facts.length, n + 1))}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Paso siguiente
        </button>
        <button
          type="button"
          disabled={revealedCount === facts.length}
          onClick={() => setRevealedCount(facts.length)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
        >
          Ver todo
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {revealedCount} / {facts.length} hechos
        </span>
      </div>

      <ol className="max-h-96 space-y-1 overflow-y-auto rounded border border-slate-200 p-2 text-sm dark:border-slate-800">
        {visible.map((fact) => (
          <li key={fact.sequence}>
            <button
              type="button"
              onClick={() => {
                const next = selected === fact.sequence ? null : fact.sequence;
                setSelected(next);
                onSelectPositions(next === null ? null : fact.positions);
              }}
              className={`w-full rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                selected === fact.sequence ? "bg-slate-100 dark:bg-slate-800" : ""
              }`}
            >
              <span className="mr-2 font-mono text-xs text-slate-400">
                {(fact.atMs / 1000).toFixed(2)}s
              </span>
              <span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs uppercase dark:bg-slate-700">
                {PHASE_LABELS[fact.phase]}
              </span>
              {fact.text}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
