import { create } from "zustand";
import type { DeviceId } from "@/lib/devices";
import { DEFAULT_PRESET, getPreset } from "@/lib/presets";
import { useCanvasStore } from "@/lib/store";

export type Theme = "light" | "dark";
export type RightTab = "design" | "code";

const KEYS = { theme: "vtu-theme", device: "vtu-device", right: "vtu-right-open", demo: "vtu-demo" } as const;

// localStorage can throw (private mode, blocked storage) or be empty: never depend on it.
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

interface StudioState {
  theme: Theme;
  device: DeviceId;
  /** The visual direction preset: used for the next generation and shown in the top bar. */
  presetId: string;
  rightOpen: boolean;
  /** Serve saved demo data for every request (one click when the live API is down). Also: ?demo=1 in the URL. */
  demo: boolean;
  rightTab: RightTab;
  /** The idea typed in the empty state (shared with the "Skip, just generate" button). */
  draft: string;

  /** Read persisted preferences. Called once on mount (the theme itself is applied before paint by a head script). */
  hydrate: () => void;
  setTheme: (theme: Theme) => void;
  setDevice: (device: DeviceId) => void;
  setRightOpen: (open: boolean) => void;
  setDemo: (on: boolean) => void;
  setRightTab: (tab: RightTab) => void;
  setDraft: (draft: string) => void;
  /** Choose a direction. With `applyToPage`, the visible page is re-themed too (undoable). */
  setPreset: (id: string, opts?: { applyToPage?: boolean }) => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  theme: "light",
  device: "desktop",
  presetId: DEFAULT_PRESET.id,
  rightOpen: true,
  demo: false,
  rightTab: "design",
  draft: "",

  hydrate: () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const device = read(KEYS.device);
    const right = read(KEYS.right);
    // ?demo=1 (or ?demo=0) in the URL wins over what was saved, so a demo link always starts the way it says.
    const param = new URLSearchParams(window.location.search).get("demo");
    if (param === "1" || param === "0") write(KEYS.demo, param);
    set({
      theme,
      device: device === "tablet" || device === "mobile" ? device : "desktop",
      rightOpen: right === null ? true : right === "1",
      demo: (param ?? read(KEYS.demo)) === "1",
    });
  },

  setTheme: (theme) => {
    // Suppress color transitions for the instant of the switch, so text and backgrounds change together.
    const root = document.documentElement;
    root.dataset.switching = "";
    window.setTimeout(() => delete root.dataset.switching, 80);
    root.dataset.theme = theme;
    write(KEYS.theme, theme);
    set({ theme });
  },
  setDevice: (device) => {
    write(KEYS.device, device);
    set({ device });
  },
  setRightOpen: (rightOpen) => {
    write(KEYS.right, rightOpen ? "1" : "0");
    set({ rightOpen });
  },
  setDemo: (demo) => {
    write(KEYS.demo, demo ? "1" : "0");
    set({ demo });
  },
  setRightTab: (rightTab) => set({ rightTab }),
  setDraft: (draft) => set({ draft }),

  setPreset: (id, opts) => {
    const preset = getPreset(id);
    if (!preset) return;
    set({ presetId: preset.id });
    if (opts?.applyToPage) {
      const { canvas, setCanvas } = useCanvasStore.getState();
      setCanvas({ ...canvas, designSystem: preset.designSystem });
    }
  },
}));
