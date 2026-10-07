"use client";

import { useState } from "react";
import { PRESETS, presetForDirection } from "@/lib/presets";
import type { Intent } from "@/lib/schema";
import { useInterviewStore } from "@/store/interview";

/** One friendly sentence: "Hero for enterprise AI security, audience: CISOs, goal: book a demo, direction: Editorial". */
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
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export function SummaryCard() {
  const intent = useInterviewStore((s) => s.intent);
  const notice = useInterviewStore((s) => s.notice);
  const { updateIntent, confirm } = useInterviewStore.getState();
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900">
      <p className="font-medium">Here&apos;s what I understood</p>
      {notice && <p className="mt-1 text-xs text-amber-700">{notice}</p>}

      {editing ? (
        <div className="mt-2 grid gap-2">
          {FIELD_LABELS.map(({ key, label }) => (
            <label key={key} className="grid gap-1 text-xs text-zinc-600">
              {label}
              <input
                className={inputClass}
                value={intent[key]}
                maxLength={key === "contentNotes" ? 4000 : 500}
                onChange={(e) => updateIntent({ [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="grid gap-1 text-xs text-zinc-600">
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
        <p className="mt-1 leading-relaxed text-zinc-700">{summarize(intent)}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => (editing ? setEditing(false) : confirm())}
          className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white"
        >
          {editing ? "Done editing" : "Confirm"}
        </button>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded-md border border-zinc-300 px-3 py-1.5">
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
