"use client";

import { useState } from "react";
import { PRESETS, presetForDirection } from "@/lib/presets";
import type { Intent } from "@/lib/schema";
import { useInterviewStore } from "@/store/interview";
import { primaryButton } from "./studio/EmptyState";
import { secondaryButton } from "./studio/Popover";

/** One friendly sentence: "Hero for enterprise AI security, audience: CISOs, direction: Editorial". */
export function summarize(i: Intent): string {
  const what = i.targetUi || "Landing page";
  const parts = [`${what} for ${i.goal || "your idea"}`];
  if (i.audience) parts.push(`audience: ${i.audience}`);
  parts.push(`direction: ${presetForDirection(i.visualDirection).name}`);
  if (i.contentNotes) parts.push(`notes: ${i.contentNotes}`);
  return parts.join(", ");
}

const FIELD_LABELS: { key: "goal" | "audience" | "targetUi" | "contentNotes"; label: string }[] = [
  { key: "targetUi", label: "Building" },
  { key: "goal", label: "Goal" },
  { key: "audience", label: "Audience" },
  { key: "contentNotes", label: "Notes" },
];

const inputClass =
  "w-full rounded-control border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-stone";

export function SummaryCard() {
  const intent = useInterviewStore((s) => s.intent);
  const notice = useInterviewStore((s) => s.notice);
  const { updateIntent, confirm } = useInterviewStore.getState();
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-card border border-line bg-panel p-4 text-sm text-ink">
      <h3 className="font-serif text-xl">Here&apos;s what I understood</h3>
      {notice && <p className="mt-1 text-xs text-stone">{notice}</p>}

      {editing ? (
        <div className="mt-3 grid gap-3">
          {FIELD_LABELS.map(({ key, label }) => (
            <label key={key} className="grid gap-1 text-xs text-stone">
              {label}
              <input
                className={inputClass}
                value={intent[key]}
                maxLength={key === "contentNotes" ? 4000 : 500}
                onChange={(e) => updateIntent({ [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="grid gap-1 text-xs text-stone">
            Direction
            <select
              className={inputClass}
              value={presetForDirection(intent.visualDirection).name}
              onChange={(e) => updateIntent({ visualDirection: e.target.value })}
            >
              {PRESETS.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <p className="mt-2 leading-relaxed text-stone">{summarize(intent)}</p>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => (editing ? setEditing(false) : confirm())} className={primaryButton}>
          {editing ? "Done editing" : "Confirm"}
        </button>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className={secondaryButton}>
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
