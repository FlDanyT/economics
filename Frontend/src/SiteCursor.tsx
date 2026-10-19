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
    let frame = 0;
    let x = 0;
    let y = 0;

    const hide = () => ring.classList.remove("on", "is-interactive");
    const draw = () => {
      ring.style.transform = `translate3d(${x - 16}px, ${y - 16}px, 0)`;
      frame = 0;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = event.target instanceof Element ? event.target : null;
      ring.classList.toggle("on", !target?.closest(nativeInteraction));
      ring.classList.toggle("is-interactive", !!target?.closest(clickable));
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(draw);
    };
    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) hide();
    };
    const updateMedia = () => {
      hide();
      if (media.matches) {
        document.addEventListener("pointermove", move, { passive: true });
        document.addEventListener("pointerout", leave);
        window.addEventListener("blur", hide);
        window.addEventListener("scroll", hide, { passive: true });
      } else {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerout", leave);
        window.removeEventListener("blur", hide);
        window.removeEventListener("scroll", hide);
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
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ringRef}
      className={`cursor-ring${location.pathname === "/" ? " on-landing" : ""}`}
      aria-hidden="true"
    />
  );
}
