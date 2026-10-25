import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const cursorMedia = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
const nativeInteraction =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], .chart-canvas, .table-wrap';
const clickable = 'a[href], button:not(:disabled), summary, [role="button"], [role="tab"]';

export function SiteCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const media = window.matchMedia(cursorMedia);

    const hide = () => ring.classList.remove("on", "is-interactive");
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target instanceof Element ? event.target : null;
      // Client coordinates and fixed positioning share the viewport coordinate system.
      // Keep movement out of transform so hover scale cannot scale the position.
      ring.style.left = `${event.clientX}px`;
      ring.style.top = `${event.clientY}px`;
      const native = !!target?.closest(nativeInteraction);
      ring.classList.toggle("on", !native);
      ring.classList.toggle("is-interactive", !native && !!target?.closest(clickable));
    };
    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) hide();
    };
    const visibilityChange = () => {
      if (document.hidden) hide();
    };
    const updateMedia = () => {
      hide();
      if (media.matches) {
        document.addEventListener("pointermove", move, { passive: true });
        document.addEventListener("pointerout", leave);
        window.addEventListener("blur", hide);
        window.addEventListener("scroll", hide, { passive: true });
        document.addEventListener("visibilitychange", visibilityChange);
      } else {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerout", leave);
        window.removeEventListener("blur", hide);
        window.removeEventListener("scroll", hide);
        document.removeEventListener("visibilitychange", visibilityChange);
      }
    };

    updateMedia();
    media.addEventListener("change", updateMedia);
    return () => {
      media.removeEventListener("change", updateMedia);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", hide);
      window.removeEventListener("scroll", hide);
      document.removeEventListener("visibilitychange", visibilityChange);
    };
  }, []);

  useEffect(() => {
    ringRef.current?.classList.remove("on", "is-interactive");
  }, [location.pathname]);

  return (
    <div
      ref={ringRef}
      className={`cursor-ring${location.pathname === "/" ? " on-landing" : ""}`}
      aria-hidden="true"
    />
  );
}
