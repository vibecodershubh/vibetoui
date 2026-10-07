"use client";

import { useRef } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Radio group styled as a segmented control. Arrow keys / Home / End move the selection (roving tabindex). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const hasValue = options.some((o) => o.value === value);

  const go = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-control border border-line bg-panel p-0.5"
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (!hasValue && i === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const keys: Record<string, () => void> = {
                ArrowRight: () => go(i + 1),
                ArrowDown: () => go(i + 1),
                ArrowLeft: () => go(i - 1),
                ArrowUp: () => go(i - 1),
                Home: () => go(0),
                End: () => go(options.length - 1),
              };
              if (keys[e.key]) {
                e.preventDefault();
                keys[e.key]();
              }
            }}
            className={`rounded-[8px] px-3 py-1.5 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
              checked ? "bg-accent-soft font-medium text-accent" : "text-stone hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
