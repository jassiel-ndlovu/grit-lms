"use client";

import * as React from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser has a connection. The server's page always says yes. */
export function useOnline(): boolean {
  return React.useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
