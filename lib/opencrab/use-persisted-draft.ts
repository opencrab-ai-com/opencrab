"use client";

import { useCallback, useEffect, useState } from "react";

export function usePersistedDraft(storageKey: string) {
  const [draft, setDraftState] = useState("");

  useEffect(() => {
    setDraftState(readDraft(storageKey));
  }, [storageKey]);

  const setDraft = useCallback(
    (value: string) => {
      setDraftState(value);
      writeDraft(storageKey, value);
    },
    [storageKey],
  );

  const clearDraft = useCallback(() => {
    setDraftState("");
    clearStoredDraft(storageKey);
  }, [storageKey]);

  return {
    draft,
    setDraft,
    clearDraft,
  };
}

function readDraft(storageKey: string) {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.sessionStorage.getItem(storageKey) || "";
  } catch {
    return "";
  }
}

function writeDraft(storageKey: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (value) {
      window.sessionStorage.setItem(storageKey, value);
      return;
    }

    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures and keep the in-memory draft.
  }
}

function clearStoredDraft(storageKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures and keep the visible draft cleared.
  }
}
