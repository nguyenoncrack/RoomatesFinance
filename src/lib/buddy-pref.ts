"use client";

import { useSyncExternalStore } from "react";

const KEY = "roommate-finance:buddy";
const EVENT = "roommate-finance:buddy-pref";

/** The little roaming helper is on unless the person turned it off. */
export function getBuddyEnabled(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setBuddyEnabled(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the switch still works until the page is closed.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Live value of the show/hide preference, shared between Settings and the helper itself. */
export function useBuddyEnabled(): boolean {
  return useSyncExternalStore(subscribe, getBuddyEnabled, () => true);
}
