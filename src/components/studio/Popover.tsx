"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export const secondaryButton =
  "whitespace-nowrap rounded-control border border-line bg-panel px-3 py-1.5 text-sm text-ink transition-colors duration-150 hover:border-stone disabled:cursor-not-allowed disabled:opacity-40";

/** A menu item. Use `checked` (with role="menuitemradio") for single-choice menus. */
export function MenuItem({
  children,
  onSelect,
  checked,
  role = "menuitem",
}: {
  children: ReactNode;
  onSelect: () => void;
  checked?: boolean;
  role?: "menuitem" | "menuitemradio";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role === "menuitemradio" ? !!checked : undefined}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-6 rounded-[8px] px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-paper ${
        checked ? "font-medium text-accent" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Button + floating menu. Esc and outside-click close it, Esc returns focus, arrows move between items. */
export function Popover({
  label,
  trigger,
  children,
  align = "right",
  disabled = false,
}: {
  label: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const moveFocus = (delta: number | "first" | "last") => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = delta === "first" ? 0 : delta === "last" ? items.length - 1 : (current + delta + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={secondaryButton}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), moveFocus(1));
            else if (e.key === "ArrowUp") (e.preventDefault(), moveFocus(-1));
            else if (e.key === "Home") (e.preventDefault(), moveFocus("first"));
            else if (e.key === "End") (e.preventDefault(), moveFocus("last"));
            else if (e.key === "Tab") close(false);
          }}
          className={`absolute top-full z-30 mt-2 min-w-[220px] rounded-card border border-line bg-panel p-1 shadow-float ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => close())}
        </div>
      )}
    </div>
  );
}
