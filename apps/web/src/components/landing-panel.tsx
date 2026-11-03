"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ConnectionPanel } from "./connection-panel";

export function LandingPanel() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTarget(document.getElementById("navi-live-panel")); }, []);
  return target ? createPortal(<ConnectionPanel />, target) : null;
}
