"use client";
import { useEffect } from "react";

/**
 * Interactive 3D tilt: any element with `.card-3d` tilts toward the cursor.
 * Uses document-level delegation so it covers cards on every page/route.
 */
export function Tilt() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia?.("(pointer: coarse)").matches) return; // skip touch devices

    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement)?.closest?.(".card-3d") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1000px) translateY(-6px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 8).toFixed(2)}deg)`;
    };
    const onOut = (e: PointerEvent) => {
      const el = (e.target as HTMLElement)?.closest?.(".card-3d") as HTMLElement | null;
      if (el && (!e.relatedTarget || !el.contains(e.relatedTarget as Node))) {
        el.style.transform = "";
      }
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerout", onOut);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
    };
  }, []);

  return null;
}
