import type { LoadResult, SaveResult } from "./save-slot";

/** Plain save/load messages for the default path (never raw assert text). */
export function plainSaveMessage(result: Extract<SaveResult, { ok: false }>): string {
  if (result.reason === "in_flight") {
    return "Cannot save while a turn is resolving.";
  }
  return "Couldn't save on this device.";
}

export function plainLoadMessage(
  result: Extract<LoadResult, { ok: false }>
): string {
  if (result.reason === "empty") {
    return "No save yet.";
  }
  return "That save can't be read. Clear save, then try again.";
}
