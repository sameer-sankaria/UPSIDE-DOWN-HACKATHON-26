"use client";
import { useEffect } from "react";
import { pingExtension } from "./extension-client";
declare global {
  interface Window { naviOs?: { pingExtension: typeof pingExtension } }
}
/** Console-only diagnostics; no website UI is introduced in Phase 1. */
export function ExtensionDiagnostics() {
  useEffect(() => {
    window.naviOs = { pingExtension };
    return () => { delete window.naviOs; };
  }, []);
  return null;
}
