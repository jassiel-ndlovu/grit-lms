"use client";

/**
 * useLocalDraft — crash-proof progress for long tutor forms.
 *
 * Authoring a test or grading a stack of answers can take an hour, and the
 * server only hears about it when the tutor clicks Save/Publish. If the
 * connection drops or the machine switches off before then, everything is
 * gone. This hook mirrors the form's state into localStorage:
 *
 *   - automatically, a short debounce after every change, and
 *   - on demand, via `saveNow()` (the "Save progress" button),
 *   - and once more on `pagehide`, the last moment a closing tab gives us.
 *
 * localStorage survives a lost connection, a closed tab and a reboot, and
 * it needs no network — which is the whole point. It is per-browser, so
 * the draft is restored on the same machine it was written on.
 *
 * On mount, if a draft newer than the server copy exists, `pending` holds
 * it and the caller shows a restore prompt. Nothing is applied silently:
 * restoring stale work over fresh server data would be its own data loss.
 * Call `clear()` after a successful server save so the prompt doesn't
 * come back.
 */

import * as React from "react";

const PREFIX = "grit-lms:draft:";
const VERSION = 1;

interface Stored<T> {
  v: number;
  savedAt: number;
  data: T;
}

export type DraftStatus = "idle" | "dirty" | "saved" | "error";

export interface UseLocalDraftOptions<T> {
  /** Unique per form + record, e.g. `test-edit:<id>`. */
  key: string;
  /** Current form state. Must be JSON-serialisable. */
  data: T;
  /** Debounce for auto-save, ms. */
  delay?: number;
  /**
   * Hold everything off until the form holds its real starting state
   * (e.g. after an edit form's record has loaded). Default true.
   */
  enabled?: boolean;
}

export interface LocalDraft<T> {
  status: DraftStatus;
  lastSavedAt: Date | null;
  /** A draft found on mount that hasn't been restored or discarded yet. */
  pending: { data: T; savedAt: Date } | null;
  saveNow: () => boolean;
  clear: () => void;
  /** Hand back the pending draft and stop offering it. */
  takePending: () => T | null;
  discardPending: () => void;
}

function read<T>(key: string): Stored<T> | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (parsed?.v !== VERSION || typeof parsed.savedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T): number | null {
  try {
    const savedAt = Date.now();
    const payload: Stored<T> = { v: VERSION, savedAt, data };
    window.localStorage.setItem(PREFIX + key, JSON.stringify(payload));
    return savedAt;
  } catch {
    // Quota exceeded or storage blocked (private mode). Surface as "error"
    // rather than throwing into the form.
    return null;
  }
}

export function useLocalDraft<T>({
  key,
  data,
  delay = 1500,
  enabled = true,
}: UseLocalDraftOptions<T>): LocalDraft<T> {
  const [status, setStatus] = React.useState<DraftStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null);
  const [pending, setPending] = React.useState<LocalDraft<T>["pending"]>(null);

  const serialized = React.useMemo(() => {
    try {
      return JSON.stringify(data);
    } catch {
      return "";
    }
  }, [data]);

  // The state as first rendered (i.e. the server copy). Auto-save skips it
  // so merely opening a form doesn't create a draft.
  const baseline = React.useRef<string | null>(null);
  const latest = React.useRef(data);
  latest.current = data;
  const enabledRef = React.useRef(enabled);
  enabledRef.current = enabled;

  // Look for an existing draft once — on mount, or for forms that load
  // their record asynchronously, the first time `enabled` turns true (so
  // the baseline is the loaded record, not the empty placeholder).
  const checkedKey = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!enabled || checkedKey.current === key) return;
    checkedKey.current = key;
    const found = read<T>(key);
    if (found) {
      let same = false;
      try {
        same = JSON.stringify(found.data) === serialized;
      } catch {
        // fall through
      }
      if (same) {
        setLastSavedAt(new Date(found.savedAt));
        setStatus("saved");
      } else {
        setPending({ data: found.data, savedAt: new Date(found.savedAt) });
      }
    }
    baseline.current = serialized;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const saveNow = React.useCallback((): boolean => {
    const at = write(key, latest.current);
    if (at == null) {
      setStatus("error");
      return false;
    }
    setLastSavedAt(new Date(at));
    setStatus("saved");
    return true;
  }, [key]);

  // Debounced auto-save. Held off while a found draft awaits the tutor's
  // restore/discard answer, so typing can't overwrite it in the meantime.
  const touched = React.useRef(false);
  React.useEffect(() => {
    if (!enabled || pending || baseline.current === null) return;
    if (!touched.current) {
      if (serialized === baseline.current) return;
      touched.current = true;
    }
    setStatus("dirty");
    const t = window.setTimeout(() => {
      saveNow();
    }, delay);
    return () => window.clearTimeout(t);
  }, [serialized, enabled, pending, delay, saveNow]);

  // Last-chance flush when the tab is hidden or closed.
  React.useEffect(() => {
    function flush() {
      if (!enabledRef.current || !touched.current) return;
      write(key, latest.current);
    }
    window.addEventListener("pagehide", flush);
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [key]);

  const clear = React.useCallback(() => {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      // ignore
    }
    baseline.current = JSON.stringify(latest.current);
    touched.current = false;
    setPending(null);
    setStatus("idle");
    setLastSavedAt(null);
  }, [key]);

  const takePending = React.useCallback((): T | null => {
    const p = pending?.data ?? null;
    setPending(null);
    return p;
  }, [pending]);

  const discardPending = React.useCallback(() => {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      // ignore
    }
    setPending(null);
  }, [key]);

  return { status, lastSavedAt, pending, saveNow, clear, takePending, discardPending };
}
