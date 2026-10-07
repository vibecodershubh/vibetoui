export type DeviceId = "desktop" | "tablet" | "mobile";

/** `width: null` = fill the available space. Widths are the preview frame's CSS pixel width. */
export const DEVICES: { id: DeviceId; label: string; width: number | null }[] = [
  { id: "desktop", label: "Desktop", width: null },
  { id: "tablet", label: "Tablet", width: 768 },
  { id: "mobile", label: "Mobile", width: 390 },
];

export const getDevice = (id: DeviceId) => DEVICES.find((d) => d.id === id) ?? DEVICES[0];
