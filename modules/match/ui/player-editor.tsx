"use client";

import { useState } from "react";
import {
  OFFENSIVE_ATTRIBUTE_IDS,
  DEFENSIVE_ATTRIBUTE_IDS,
  MENTAL_ATTRIBUTE_IDS,
  PHYSICAL_ATTRIBUTE_IDS,
  ATTRIBUTE_LABELS,
  ratingToLetterGrade,
  isValidRating,
  type ActiveAttributeId,
} from "@match/domain/players/attribute";
import { checkPlayerCoherence } from "@match/domain/players/player-validation";
import type { PlayerProfile } from "@match/domain/players/player-profile";

interface PlayerEditorProps {
  readonly player: PlayerProfile;
  readonly onSave: (player: PlayerProfile) => Promise<void>;
  readonly onDuplicate: (player: PlayerProfile) => Promise<void>;
  readonly saving: boolean;
}

const GROUPS: { title: string; ids: readonly ActiveAttributeId[] }[] = [
  { title: "Ofensivos", ids: OFFENSIVE_ATTRIBUTE_IDS },
  { title: "Defensivos / rebote", ids: DEFENSIVE_ATTRIBUTE_IDS },
  { title: "Mentales", ids: MENTAL_ATTRIBUTE_IDS },
  { title: "Físicos", ids: PHYSICAL_ATTRIBUTE_IDS },
];

export function PlayerEditor({ player, onSave, onDuplicate, saving }: PlayerEditorProps) {
  const [draft, setDraft] = useState<PlayerProfile>(player);

  const warnings = checkPlayerCoherence(draft);

  function updateAttribute(id: ActiveAttributeId, value: string) {
    const parsed = Number(value);
    if (!isValidRating(parsed)) return;
    setDraft((prev) => ({ ...prev, attributes: { ...prev.attributes, [id]: parsed } }));
  }

  function updateMeasure(key: keyof PlayerProfile["measures"], value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setDraft((prev) => ({ ...prev, measures: { ...prev.measures, [key]: parsed } }));
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{draft.id}</p>
          <input
            className="rounded border border-slate-300 bg-transparent px-2 py-1 text-lg font-semibold dark:border-slate-700"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">{draft.positionLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-sm">
          Altura (cm)
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
            value={draft.measures.heightCm}
            onChange={(e) => updateMeasure("heightCm", e.target.value)}
          />
        </label>
        <label className="text-sm">
          Peso (kg)
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
            value={draft.measures.weightKg}
            onChange={(e) => updateMeasure("weightKg", e.target.value)}
          />
        </label>
        <label className="text-sm">
          Envergadura (cm)
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
            value={draft.measures.wingspanCm}
            onChange={(e) => updateMeasure("wingspanCm", e.target.value)}
          />
        </label>
        <label className="text-sm">
          Alcance de pie (cm)
          <input
            type="number"
            className="mt-1 w-full rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
            value={draft.measures.standingReachCm}
            onChange={(e) => updateMeasure("standingReachCm", e.target.value)}
          />
        </label>
      </div>

      {GROUPS.map((group) => (
        <fieldset key={group.title} className="space-y-2">
          <legend className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {group.title}
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.ids.map((id) => (
              <label key={id} className="flex items-center justify-between gap-2 text-xs">
                <span title={ATTRIBUTE_LABELS[id]}>
                  {id} · {ATTRIBUTE_LABELS[id]}
                </span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={15}
                    className="w-14 rounded border border-slate-300 bg-transparent px-1 py-0.5 text-right dark:border-slate-700"
                    value={draft.attributes[id]}
                    onChange={(e) => updateAttribute(id, e.target.value)}
                  />
                  <span className="font-mono text-slate-500">
                    {ratingToLetterGrade(draft.attributes[id])}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <label className="flex items-center gap-2 text-sm">
        Tendencia en bloqueo directo:
        <select
          className="rounded border border-slate-300 bg-transparent px-2 py-1 dark:border-slate-700"
          value={draft.pnrTendency}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              pnrTendency: e.target.value as PlayerProfile["pnrTendency"],
            }))
          }
        >
          <option value="priorizar_primera_opcion">Priorizar primera opción</option>
          <option value="explorar_segunda_opcion">Explorar segunda opción</option>
        </select>
      </label>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {warnings.map((w) => (
            <li key={w.code}>⚠ {w.message}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave(draft)}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onDuplicate(draft)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium dark:border-slate-700"
        >
          Duplicar
        </button>
      </div>
    </div>
  );
}
