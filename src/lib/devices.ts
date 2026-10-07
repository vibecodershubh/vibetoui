export type DeviceId = "desktop" | "tablet" | "mobile";

/** `width` is the page's layout width in CSS pixels. If the stage is narrower, the frame is scaled down to fit. */
export const DEVICES: { id: DeviceId; label: string; width: number }[] = [
  { id: "desktop", label: "Desktop", width: 1280 },
  { id: "tablet", label: "Tablet", width: 820 },
  { id: "mobile", label: "Mobile", width: 390 },
];

export const getDevice = (id: DeviceId) => DEVICES.find((d) => d.id === id) ?? DEVICES[0];

/** Scale that fits a `width`-px layout into `available` px of stage (never above 1, never unreadably small). */
export function fitScale(available: number, width: number): number {
  if (!(available > 0)) return 1;
  return Math.min(1, Math.max(0.2, available / width));
}
