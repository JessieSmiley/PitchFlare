"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Debounces a save function and surfaces a small "idle | saving | saved |
 * error" state for the optimistic-UI indicator. Default debounce is 800ms
 * which is low enough to feel responsive on typing but high enough to
 * avoid spamming the DB on every keystroke.
 */
export function useAutoSave<T>(opts: {
  value: T;
  save: (value: T) => Promise<{ ok: boolean; error?: string }>;
  /** Skip autosave if this returns true — e.g. a required field is empty. */
  skip?: (value: T) => boolean;
  debounceMs?: number;
}) {
  const { value, save, skip, debounceMs = 800 } = opts;
  const [state, setState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirst = useRef(true);
  const lastSavedJSON = useRef<string>(JSON.stringify(value));

  // Stash a reference to the latest save fn so debounce doesn't close
  // over a stale one if it changes between renders.
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const serialized = JSON.stringify(value);
    if (serialized === lastSavedJSON.current) return;
    if (skip?.(value)) return;

    if (timer.current) clearTimeout(timer.current);
    setState("saving");
    timer.current = setTimeout(async () => {
      const res = await saveRef.current(value);
      if (res.ok) {
        lastSavedJSON.current = serialized;
        setState("saved");
        setErrorMsg(null);
        // After 1.5s idle, fade back to neutral.
        setTimeout(() => setState("idle"), 1500);
      } else {
        setState("error");
        setErrorMsg(res.error ?? "Save failed");
      }
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, skip, debounceMs]);

  const forceSaveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (skip?.(value)) return;
    setState("saving");
    const res = await saveRef.current(value);
    if (res.ok) {
      lastSavedJSON.current = JSON.stringify(value);
      setState("saved");
      setErrorMsg(null);
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("error");
      setErrorMsg(res.error ?? "Save failed");
    }
  }, [value, skip]);

  return { state, errorMsg, forceSaveNow };
}

export function SaveIndicator({
  state,
  errorMsg,
}: {
  state: SaveState;
  errorMsg: string | null;
}) {
  if (state === "idle") return null;
  const tone =
    state === "error"
      ? "text-destructive"
      : state === "saving"
        ? "text-muted-foreground"
        : "text-brand-pink";
  const label =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : errorMsg ?? "Save failed";
  return <span className={`text-xs ${tone}`}>{label}</span>;
}
