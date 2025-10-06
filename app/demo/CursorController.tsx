"use client";

import React, { useEffect } from "react";
import { createRoot, Root } from "react-dom/client";

/**
 * CursorController
 *
 * Mount this component once on a page (e.g. in the demo at `/demo`). It registers a
 * global function `window.__cursorGuide(stepsOrTarget, options?)` that moves a fake
 * cursor to a target and optionally performs actions (click, drag).
 *
 * In `app/demo/page.tsx`, a convenience wrapper `guideCursorTo(targetOrSteps, options?)`
 * is also exported and exposed globally as `window.guideCursorTo`.
 *
 * Quick examples (run in DevTools on /demo):
 * ```js
 * // Move to a screen position
 * await window.guideCursorTo({ position: { x: 140, y: 160 } }, { durationMs: 700 });
 *
 * // Click an element by selector or id
 * await window.guideCursorTo('#submitBtn', { action: 'click', anchor: 'center' });
 *
 * // Drag from one element to another
 * await window.guideCursorTo({ selector: '#cardBacklog0' }, { action: 'drag', dragTo: '#doingDrop' });
 *
 * // Multi-step sequence
 * await window.guideCursorTo([
 *   { target: '#tabStats', action: 'click', options: { durationMs: 600 } },
 *   { target: { position: { x: 100, y: 120 } } },
 *   { target: '#progressStartBtn', action: 'click' },
 * ]);
 * ```
 *
 * Options highlights (see `GuideOptions`):
 * - action: 'none' | 'click' | 'drag'
 * - durationMs, easing: control motion speed/curve
 * - path: 'straight' | 'curve', curveStrength, curveDirection
 * - anchor: where inside the element to aim (e.g. 'center', 'top-left' or {x:0..1,y:0..1})
 * - cursorHotspot: px offset to the click location
 * - dragTo: target for drag action
 */

// Types for the public API
export type GuideAction = "none" | "click" | "drag";

export type GuideTarget =
  | string // id or selector (resolved as id first)
  | Element
  | { selector: string; nth?: number; within?: Element | string }
  | { position: { x: number; y: number } };

export type Anchor = "center" | "top-left" | "bottom-right" | { x: number; y: number };

export type GuideOptions = {
  action?: GuideAction;
  durationMs?: number; // total travel duration
  easing?: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear";
  offset?: { x?: number; y?: number };
  highlight?: boolean; // briefly highlight target when reached
  // Path options
  path?: "straight" | "curve"; // default curve
  curveStrength?: number; // 0..1, fraction of distance used as bend magnitude (default 0.25)
  curveDirection?: "auto" | "left" | "right"; // default auto
  // New options
  anchor?: Anchor; // where inside the element to aim
  cursorHotspot?: { x?: number; y?: number }; // px offset added to click/press location
  dragTo?: GuideTarget; // destination target for action='drag'
};

export type GuideStep = { target: GuideTarget; action?: GuideAction; options?: GuideOptions };
export type GuideStepResult = { ok: boolean; action: GuideAction; targetKind: "element" | "position"; durationMs: number; clickedElementId?: string | null; error?: string };
export type GuideRunResult = { ok: boolean; steps: GuideStepResult[] };

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
  curveDirection: GuideOptions["curveDirection"] = "auto",
  onFrame?: (p: { x: number; y: number; t: number; now: number }) => void
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
      if (onFrame) onFrame({ x: x + nx, y: y + ny, t, now });
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
    const isDown = type === "pointerdown" || type === "mousedown";
    const isUp = type === "pointerup" || type === "mouseup";
    const enriched = {
      button: 0,
      buttons: isDown ? 1 : 0,
      isPrimary: true,
      ...common,
    };
    if ("PointerEvent" in window) {
      // @ts-ignore - PointerEvent init differs slightly
      const ev = new PointerEvent(type, { pointerId: 1, pointerType: "mouse", ...enriched });
      target.dispatchEvent(ev);
    } else {
      const ev = new MouseEvent(type, enriched as MouseEventInit);
      target.dispatchEvent(ev);
    }
  } catch {
    const ev = new MouseEvent(type, common);
    target.dispatchEvent(ev);
  }
}

function isElement(obj: any): obj is Element {
  return obj && typeof obj === "object" && obj.nodeType === 1;
}

function resolveWithin(within?: Element | string | null): Element | Document {
  if (!within) return document;
  if (isElement(within)) return within;
  if (typeof within === "string") {
    const byId = document.getElementById(within);
    if (byId) return byId;
    const q = document.querySelector(within);
    if (q) return q as Element;
  }
  return document;
}

function resolveTarget(target: GuideTarget): { kind: "element" | "position"; element?: Element | null; point?: { x: number; y: number } } {
  if (isElement(target)) return { kind: "element", element: target };
  if (typeof target === "string") {
    const byId = document.getElementById(target);
    if (byId) return { kind: "element", element: byId };
    const q = document.querySelector(target);
    return { kind: q ? "element" : "position", element: q ?? null };
  }
  if (typeof target === "object" && "position" in target) {
    return { kind: "position", point: target.position };
  }
  if (typeof target === "object" && "selector" in target) {
    const scope = resolveWithin(target.within ?? null);
    const all = (scope as Element | Document).querySelectorAll(target.selector);
    const idx = Math.max(0, Math.min(all.length - 1, target.nth ?? 0));
    const el = all[idx] ?? null;
    return { kind: el ? "element" : "position", element: el };
  }
  return { kind: "position", point: { x: 0, y: 0 } };
}

function getAnchoredPoint(el: Element, anchor?: Anchor) {
  const r = el.getBoundingClientRect();
  if (!anchor || anchor === "center") return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  if (anchor === "top-left") return { x: r.left, y: r.top };
  if (anchor === "bottom-right") return { x: r.right, y: r.bottom };
  const ax = clamp(anchor.x, 0, 1);
  const ay = clamp(anchor.y, 0, 1);
  return { x: r.left + r.width * ax, y: r.top + r.height * ay };
}

function clampToViewport(p: { x: number; y: number }) {
  return { x: clamp(p.x, 0, window.innerWidth), y: clamp(p.y, 0, window.innerHeight) };
}

 

function CursorController() {
  useEffect(() => {
    (window as any).__cursorGuide = async (
      stepsOrTarget: GuideTarget | GuideStep[],
      options: GuideOptions = {}
    ): Promise<GuideRunResult> => {
      const steps: GuideStep[] = Array.isArray(stepsOrTarget)
        ? stepsOrTarget
        : [{ target: stepsOrTarget, action: options.action ?? "none", options }];

      const results: GuideStepResult[] = [];
      const cursor = await getOrCreateCursor();
      cursor.classList.add("visible", "as-arrow");
      cursor.classList.remove("as-pointer", "pressing");
      ensureCursorVisible(cursor);
      keepCursorVisibleWhileMoving();
      const curX = parseFloat(cursor.style.left || "20") || 20;
      const curY = parseFloat(cursor.style.top || "20") || 20;
      updateCursorColorAt(cursor, curX, curY);

      for (const s of steps) {
        const {
          durationMs = 800,
          easing = "ease-in-out",
          offset,
          highlight = true,
          path = "curve",
          curveStrength = 0.25,
          curveDirection = "auto",
          anchor,
          cursorHotspot,
          dragTo,
        } = s.options ?? {};

        const action: GuideAction = s.action ?? (s.options?.action ?? "none");
        const t0 = performance.now();

        const resolved = resolveTarget(s.target);
        let targetPoint: { x: number; y: number } | null = null;
        let targetElement: Element | null = null;
        if (resolved.kind === "element" && resolved.element) {
          targetElement = resolved.element;
          targetElement.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          await waitForScrollSettled(1500, 180);
          targetPoint = getAnchoredPoint(targetElement, anchor);
        } else if (resolved.kind === "position" && resolved.point) {
          targetPoint = resolved.point;
        }
        if (!targetPoint) {
          results.push({ ok: false, action, targetKind: resolved.kind, durationMs: Math.round(performance.now() - t0), error: "Target not found" });
          continue;
        }

        const from = {
          x: parseFloat(cursor.style.left || "20") || 20,
          y: parseFloat(cursor.style.top || "20") || 20,
        };
        const to = clampToViewport(applyOffset(targetPoint, offset));

        await animatePosition(cursor, from, to, durationMs, easing, path, curveStrength, curveDirection);

        // Small overshoot and settle
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const overshoot = Math.min(6, Math.max(3, dist * 0.02));
        const over = { x: to.x + ux * overshoot, y: to.y + uy * overshoot };
        await animatePosition(cursor, to, over, Math.max(70, durationMs * 0.1), "ease-out", "straight", 0, "right");
        await animatePosition(cursor, over, to, 120, "ease-out", "straight", 0, "left");

        if (highlight) {
          (cursor as any).classList?.add("click");
          setTimeout(() => (cursor as any).classList?.remove("click"), 180);
        }

        let clickedId: string | null = null;
        try {
          if (action === "click") {
            cursor.classList.remove("as-arrow");
            cursor.classList.add("as-pointer", "pressing");
            const hotspot = { x: cursorHotspot?.x ?? 0, y: cursorHotspot?.y ?? 0 };
            const p = { x: to.x + hotspot.x, y: to.y + hotspot.y };
            cursor.style.left = `${p.x}px`;
            cursor.style.top = `${p.y}px`;
            updateCursorColorAt(cursor, p.x, p.y);
            const clickTarget = targetElement ?? document.elementFromPoint(p.x, p.y) ?? document.body;
            dispatchMouseLike(clickTarget, "pointerdown", p);
            dispatchMouseLike(clickTarget, "mousedown", p);
            await new Promise((r) => setTimeout(r, 90));
            cursor.classList.remove("pressing");
            dispatchMouseLike(clickTarget, "mouseup", p);
            dispatchMouseLike(clickTarget, "click", p);
            setTimeout(() => {
              cursor.classList.remove("as-pointer");
              cursor.classList.add("as-arrow");
            }, 140);
            if (clickTarget instanceof HTMLElement) clickTarget.focus?.();
            clickedId = (clickTarget as HTMLElement)?.id ?? null;
          } else if (action === "drag") {
            if (!dragTo) throw new Error("dragTo is required for action 'drag'");
            const dest = resolveTarget(dragTo);
            let destPoint: { x: number; y: number } | null = null;
            if (dest.kind === "element" && dest.element) destPoint = getAnchoredPoint(dest.element, anchor);
            if (dest.kind === "position" && dest.point) destPoint = dest.point;
            if (!destPoint) throw new Error("dragTo target not found");
            const dst = clampToViewport(applyOffset(destPoint, offset));

            const startP = { x: to.x, y: to.y };
            const startTarget = targetElement ?? document.elementFromPoint(startP.x, startP.y) ?? document.body;
            cursor.classList.remove("as-arrow");
            cursor.classList.add("as-pointer", "pressing");
            dispatchMouseLike(startTarget, "pointerdown", startP);
            dispatchMouseLike(startTarget, "mousedown", startP);

            await animatePosition(cursor, startP, dst, Math.max(200, durationMs), easing, path, curveStrength, curveDirection, ({ x, y }) => {
              const moveTarget = document.elementFromPoint(x, y) ?? document.body;
              dispatchMouseLike(moveTarget, "pointermove", { x, y });
              dispatchMouseLike(moveTarget, "mousemove", { x, y });
            });

            const endTarget = document.elementFromPoint(dst.x, dst.y) ?? document.body;
            cursor.classList.remove("pressing");
            dispatchMouseLike(endTarget, "pointerup", dst);
            dispatchMouseLike(endTarget, "mouseup", dst);
          }

          results.push({ ok: true, action, targetKind: resolved.kind, durationMs: Math.round(performance.now() - t0), clickedElementId: clickedId });
        } catch (e: any) {
          results.push({ ok: false, action, targetKind: resolved.kind, durationMs: Math.round(performance.now() - t0), error: e?.message ?? String(e) });
        }
      }

      stopMovingAndMaybeHide(cursor, 2000);
      return { ok: results.every(r => r.ok), steps: results };
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
