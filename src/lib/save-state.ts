/** What the saving indicator (components/ui/save-state.tsx) says. */

export type SaveKind = "idle" | "pending" | "saving" | "saved" | "failed";
/** Saved in Nexa, or only kept in this browser. */
export type SaveWhere = "nexa" | "device";

export function saveText(
  kind: SaveKind,
  opts: { where?: SaveWhere; offline?: boolean; error?: string | null; time?: string | null } = {},
): string {
  const device = opts.where === "device";
  if (kind === "failed") return opts.error ?? (device ? "Couldn't save on this device" : "Not saved");
  if (opts.offline) {
    if (device) return "Offline, kept on this device";
    return kind === "saved" || kind === "idle" ? "Offline" : "Offline, not saved yet";
  }
  if (kind === "saving") return "Saving…";
  if (kind === "pending") return "Not saved yet";
  if (kind === "saved") {
    const when = opts.time ? ` ${opts.time}` : "";
    return device ? `Saved on this device${when}` : `Saved${when}`;
  }
  return device ? "Saves on this device as you go" : "Saves as you go";
}
