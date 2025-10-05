"use client";

import React, { useEffect } from "react";
import { createRoot, Root } from "react-dom/client";

// Types for the public API
export type GuideAction = "none" | "click" | "drag";
export type GuideOptions = {
  action?: GuideAction;
  durationMs?: number; // total travel duration
  easing?: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear";
  offset?: { x?: number; y?: number };
  highlight?: boolean; // briefly highlight target when reached
  // Drag-specific options:
  toValue?: number; // for input[type="range"] drag target value
  toElementId?: string; // general drag target element id
  // Path options
  path?: "straight" | "curve"; // default curve
  curveStrength?: number; // 0..1, fraction of distance used as bend magnitude (default 0.25)
  curveDirection?: "auto" | "left" | "right"; // default auto
};

// Cursor controller state (DOM-based, no React re-renders)
let cursorReactRoot: Root | null = null;
let cursorSvgCache: { arrow?: string; pointer?: string } = {};

// Visibility/idle management so the cursor never disappears while moving
let cursorHideTimer: number | null = null;
let cursorIsMoving = false;

function ensureCursorVisible(cursor: HTMLElement) {
  cursor.classList.add("visible");
}

function keepCursorVisibleWhileMoving() {
  cursorIsMoving = true;
  if (cursorHideTimer != null) {
    clearTimeout(cursorHideTimer);
    cursorHideTimer = null;
  }
}

function scheduleCursorHide(cursor: HTMLElement, ms = 1500) {
  if (cursorIsMoving) return;
  if (cursorHideTimer != null) {
    clearTimeout(cursorHideTimer);
  }
  cursorHideTimer = window.setTimeout(() => {
    if (!cursorIsMoving) cursor.classList.remove("visible");
  }, ms);
}

function stopMovingAndMaybeHide(cursor: HTMLElement, ms = 1200) {
  cursorIsMoving = false;
  scheduleCursorHide(cursor, ms);
}

// Wait until window scrolling appears settled to reduce coordinate mismatch
async function waitForScrollSettled(timeoutMs = 1500, quietMs = 160) {
  const getPos = () => ({ x: window.scrollX || document.documentElement.scrollLeft || 0, y: window.scrollY || document.documentElement.scrollTop || 0 });
  const start = performance.now();
  let last = getPos();
  let lastChange = performance.now();
  return new Promise<void>((resolve) => {
    function tick(now: number) {
      const cur = getPos();
      if (cur.x !== last.x || cur.y !== last.y) {
        last = cur;
        lastChange = now;
      }
      if (now - lastChange >= quietMs || now - start >= timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

async function loadCursorSvgs() {
  if (!cursorSvgCache.arrow) {
    try {
      const [arrowRes, pointerRes] = await Promise.all([
        fetch("/cursor.svg"),
        fetch("/cursor_hand.svg"),
      ]);
      cursorSvgCache.arrow = await arrowRes.text();
      cursorSvgCache.pointer = await pointerRes.text();
    } catch (e) {
      console.warn("Failed to load cursor SVGs", e);
    }
  }
  return cursorSvgCache;
}

function CursorVisual({ arrowSvg, pointerSvg }: { arrowSvg?: string; pointerSvg?: string }) {
  return (
    <>
      {arrowSvg && (
        <div className="arrow" dangerouslySetInnerHTML={{ __html: arrowSvg }} />
      )}
      {pointerSvg && (
        <div className="pointer" dangerouslySetInnerHTML={{ __html: pointerSvg }} />
      )}
    </>
  );
}

async function getOrCreateCursor(): Promise<HTMLDivElement> {
  const id = "demo-fake-cursor";
  let cursor = document.getElementById(id) as HTMLDivElement | null;
  const svgs = await loadCursorSvgs();

  if (!cursor) {
    cursor = document.createElement("div");
    cursor.id = id;
    cursor.className = "fake-cursor as-arrow";
    cursor.style.position = "fixed";
    cursor.style.left = "20px";
    cursor.style.top = "20px";
    document.body.appendChild(cursor);
    // mount React visuals
    cursorReactRoot = createRoot(cursor);
    cursorReactRoot.render(<CursorVisual arrowSvg={svgs.arrow} pointerSvg={svgs.pointer} />);
  } else {
    cursor.classList.add("as-arrow");
    if (!cursorReactRoot) {
      cursorReactRoot = createRoot(cursor);
      cursorReactRoot.render(<CursorVisual arrowSvg={svgs.arrow} pointerSvg={svgs.pointer} />);
    }
  }
  return cursor;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Background color sampling and contrast
function cssColorToRgba(css: string): { r: number; g: number; b: number; a: number } | null {
  if (!css) return null;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillStyle = css; // triggers parsing
  // computed value will be in rgb/rgba
  const parsed = ctx.fillStyle as string;
  const m = parsed.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(/\s*,\s*/).map(Number);
  const [r, g, b, a = 1] = parts;
  return { r, g, b, a };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const srgb = [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function isDarkColor(css: string | null) {
  const rgba = css ? cssColorToRgba(css) : null;
  if (!rgba) return false;
  // Consider fully transparent as light (to prefer dark cursor)
  if (rgba.a === 0) return false;
  return relativeLuminance(rgba) < 0.5;
}

function getEffectiveBackgroundAtPoint(x: number, y: number): string | null {
  let el = document.elementFromPoint(x, y) as HTMLElement | null;
  const seen = new Set<HTMLElement>();
  while (el && !seen.has(el)) {
    seen.add(el);
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const rgba = cssColorToRgba(bg);
    if (rgba && rgba.a > 0) return bg;
    el = el.parentElement as HTMLElement | null;
  }
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  return bodyBg || "rgb(255,255,255)";
}

function updateCursorColorAt(cursor: HTMLElement, x: number, y: number) {
  const bg = getEffectiveBackgroundAtPoint(x, y);
  const dark = isDarkColor(bg);
  const strokeColor = dark ? "#ffffff" : "#000000";

  // Update all path elements in the cursor SVGs
  const paths = cursor.querySelectorAll("svg path");
  paths.forEach((path) => {
    (path as SVGPathElement).style.fill = "white";
    (path as SVGPathElement).style.stroke = strokeColor;
    (path as SVGPathElement).style.strokeWidth = "1";
  });

  // Add contrasting shadow for extra visibility
  cursor.style.filter = dark
    ? "drop-shadow(0 1px 2px rgba(0,0,0,0.8))"
    : "drop-shadow(0 1px 2px rgba(255,255,255,0.9))";
}

async function animatePosition(
  el: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  durationMs: number,
  easing: GuideOptions["easing"] = "ease-in-out",
  path: GuideOptions["path"] = "curve",
  curveStrength: number = 0.25,
  curveDirection: GuideOptions["curveDirection"] = "auto"
) {
  // Keep the cursor visible for the entire duration of this animation
  keepCursorVisibleWhileMoving();
  ensureCursorVisible(el);

  const start = performance.now();
  const easeFn = easing === "linear" ? (t: number) => t : easeInOutCubic;

  // Precompute control point for a quadratic Bezier if using curve
  const useCurve = path !== "straight";
  let cp = { x: 0, y: 0 };
  if (useCurve) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    // Perpendicular normal (clockwise)
    let nx = -dy / dist;
    let ny = dx / dist;
    let sign = 1;
    if (curveDirection === "left") sign = -1;
    else if (curveDirection === "right") sign = 1;
    else {
      // auto: randomize direction for variety
      sign = Math.random() < 0.5 ? -1 : 1;
    }
    const bend = clamp(curveStrength, 0, 1) * dist;
    cp = { x: mx + sign * nx * bend, y: my + sign * ny * bend };
  }

  return new Promise<void>((resolve) => {
    function frame(now: number) {
      const t = clamp((now - start) / durationMs, 0, 1);
      const k = easeFn(t);
      let x: number, y: number;
      if (useCurve) {
        // Quadratic Bezier: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
        const u = 1 - k;
        x = u * u * from.x + 2 * u * k * cp.x + k * k * to.x;
        y = u * u * from.y + 2 * u * k * cp.y + k * k * to.y;
      } else {
        x = from.x + (to.x - from.x) * k;
        y = from.y + (to.y - from.y) * k;
      }
      // Add subtle wobble for realism (very small amplitude), taper to 0 near end
      const wobbleBase = 0.35;
      const wobbleAmp = wobbleBase * (1 - k);
      const nx = Math.sin(now * 0.02) * wobbleAmp;
      const ny = Math.cos(now * 0.018) * wobbleAmp;
      el.style.left = `${x + nx}px`;
      el.style.top = `${y + ny}px`;
      updateCursorColorAt(el, x + nx, y + ny);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

function getCenterPoint(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function applyOffset(p: { x: number; y: number }, offset?: { x?: number; y?: number }) {
  return { x: p.x + (offset?.x ?? 0), y: p.y + (offset?.y ?? 0) };
}

function dispatchMouseLike(
  target: Element,
  type: string,
  point: { x: number; y: number },
  extra?: any
) {
  const common = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: point.x,
    clientY: point.y,
    ...extra,
  };

  try {
    if ("PointerEvent" in window) {
      // @ts-ignore - PointerEvent init differs slightly
      const ev = new PointerEvent(type, { pointerId: 1, pointerType: "mouse", ...common });
      target.dispatchEvent(ev);
    } else {
      const ev = new MouseEvent(type, common);
      target.dispatchEvent(ev);
    }
  } catch {
    const ev = new MouseEvent(type, common);
    target.dispatchEvent(ev);
  }
}

function dispatchInputChange(el: HTMLInputElement) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function CursorController() {
  useEffect(() => {
    (window as any).__cursorGuide = async (id: string, options: GuideOptions = {}) => {
      const {
        action = "none",
        durationMs = 800,
        easing = "ease-in-out",
        offset,
        highlight = true,
        toValue,
        toElementId,
        path = "curve",
        curveStrength = 0.25,
        curveDirection = "auto",
      } = options;

      const target = document.getElementById(id);
      if (!target) {
        console.warn(`[guideCursorTo] No element with id="${id}"`);
        return;
      }

      // Ensure on screen and wait for scrolling to settle to avoid misaligned clicks
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      await waitForScrollSettled(1500, 180);

      const cursor = await getOrCreateCursor();
      cursor.classList.add("visible", "as-arrow");
      cursor.classList.remove("as-pointer", "pressing");
      ensureCursorVisible(cursor);
      keepCursorVisibleWhileMoving();
      // Set initial color based on current position
      const curX = parseFloat(cursor.style.left || "20") || 20;
      const curY = parseFloat(cursor.style.top || "20") || 20;
      updateCursorColorAt(cursor, curX, curY);

      const from = {
        x: parseFloat(cursor.style.left || "20") || 20,
        y: parseFloat(cursor.style.top || "20") || 20,
      };
      const to = applyOffset(getCenterPoint(target), offset);

      await animatePosition(cursor, from, to, durationMs, easing, path, curveStrength, curveDirection);
      // Subtle overshoot and settle for more lifelike motion (skip for drags)
      if (action !== "drag") {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const overshoot = Math.min(6, Math.max(3, dist * 0.02));
        const over = { x: to.x + ux * overshoot, y: to.y + uy * overshoot };
        await animatePosition(cursor, to, over, Math.max(70, durationMs * 0.1), "ease-out", "straight", 0, "right");
        await animatePosition(cursor, over, to, 120, "ease-out", "straight", 0, "left");
      }

      // Optional highlight pulse on target
      if (highlight) {
        (cursor as any).classList?.add("click");
        setTimeout(() => (cursor as any).classList?.remove("click"), 180);
      }

      // Perform action
      if (action === "click") {
        const p = getCenterPoint(target);
        // Visual: pointer shape + press
        cursor.classList.remove("as-arrow");
        cursor.classList.add("as-pointer", "pressing");
        // Snap visual cursor to the exact click point to avoid mismatch
        cursor.style.left = `${p.x}px`;
        cursor.style.top = `${p.y}px`;
        updateCursorColorAt(cursor, p.x, p.y);
        dispatchMouseLike(target, "pointerdown", p);
        dispatchMouseLike(target, "mousedown", p);
        await new Promise((r) => setTimeout(r, 90));
        cursor.classList.remove("pressing");
        dispatchMouseLike(target, "mouseup", p);
        dispatchMouseLike(target, "click", p);
        // revert to arrow after brief moment
        setTimeout(() => {
          cursor.classList.remove("as-pointer");
          cursor.classList.add("as-arrow");
        }, 140);
        if (target instanceof HTMLElement) target.focus?.();
      } else if (action === "drag") {
        const startPoint = getCenterPoint(target);
        // Visual: pointer shape + press while dragging
        cursor.classList.remove("as-arrow");
        cursor.classList.add("as-pointer", "pressing");
        keepCursorVisibleWhileMoving();
        dispatchMouseLike(target, "pointerdown", startPoint);
        dispatchMouseLike(target, "mousedown", startPoint);

        let endPoint = startPoint;

        // Drag to another element center if provided
        if (toElementId) {
          const endEl = document.getElementById(toElementId);
          if (endEl) endPoint = getCenterPoint(endEl);
        }

        // Drag a range slider to a value if applicable
        if ((target as HTMLInputElement).tagName === "INPUT" && (target as HTMLInputElement).type === "range" && typeof toValue === "number") {
          const input = target as HTMLInputElement;
          const r = input.getBoundingClientRect();
          const min = isNaN(parseFloat(input.min)) ? 0 : parseFloat(input.min);
          const max = isNaN(parseFloat(input.max)) ? 100 : parseFloat(input.max);
          const next = clamp(toValue, min, max);
          const t = (next - min) / (max - min || 1);
          endPoint = { x: r.left + r.width * t, y: r.top + r.height / 2 };

          // Simulate a smooth drag with multiple pointermoves + value updates
          const steps = 20;
          for (let i = 1; i <= steps; i++) {
            const k = i / steps;
            const xi = startPoint.x + (endPoint.x - startPoint.x) * k;
            const yi = startPoint.y + (endPoint.y - startPoint.y) * k;
            dispatchMouseLike(target, "pointermove", { x: xi, y: yi });
            dispatchMouseLike(target, "mousemove", { x: xi, y: yi });
            // Update value progressively for visual feedback
            const vi = min + (next - min) * k;
            input.value = String(vi);
            dispatchInputChange(input);
            // Move the fake cursor along with the drag
            const cx = parseFloat(cursor.style.left);
            const cy = parseFloat(cursor.style.top);
            const dx = xi - cx;
            const dy = yi - cy;
            cursor.style.left = `${cx + dx / 1}px`;
            cursor.style.top = `${cy + dy / 1}px`;
            updateCursorColorAt(cursor, xi, yi);
            // small delay to make it visible
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, Math.max(4, durationMs / steps / 2)));
          }
        } else {
          // Generic drag animation: move fake cursor then send move events
          await animatePosition(
            cursor,
            startPoint,
            endPoint,
            Math.max(300, durationMs * 0.6),
            easing,
            path,
            curveStrength,
            curveDirection
          );
          dispatchMouseLike(target, "pointermove", endPoint);
          dispatchMouseLike(target, "mousemove", endPoint);
        }

        dispatchMouseLike(target, "pointerup", endPoint);
        dispatchMouseLike(target, "mouseup", endPoint);
        cursor.classList.remove("pressing", "as-pointer");
        cursor.classList.add("as-arrow");
      }
      // Schedule hide only after idle; never during movement
      stopMovingAndMaybeHide(cursor, 2000);
    };
    return () => {
      try {
        delete (window as any).__cursorGuide;
      } catch {
        (window as any).__cursorGuide = undefined;
      }
    };
  }, []);

  return null;
}

export default CursorController;
