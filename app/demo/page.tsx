"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

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
};

// Cursor controller (DOM-based, no React re-renders)
function getOrCreateCursor(): HTMLDivElement {
  const id = "demo-fake-cursor";
  let cursor = document.getElementById(id) as HTMLDivElement | null;
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.id = id;
    cursor.className = "fake-cursor";
    cursor.style.position = "fixed";
    cursor.style.left = "20px";
    cursor.style.top = "20px";
    cursor.style.opacity = "0"; // start hidden
    cursor.style.transition = "opacity 150ms ease";
    document.body.appendChild(cursor);
  }
  return cursor;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

async function animatePosition(
  el: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
  durationMs: number,
  easing: GuideOptions["easing"] = "ease-in-out"
) {
  const start = performance.now();
  const easeFn = easing === "linear" ? (t: number) => t : easeInOutCubic;

  return new Promise<void>((resolve) => {
    function frame(now: number) {
      const t = clamp((now - start) / durationMs, 0, 1);
      const k = easeFn(t);
      const x = from.x + (to.x - from.x) * k;
      const y = from.y + (to.y - from.y) * k;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
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

export async function guideCursorTo(id: string, options: GuideOptions = {}) {
  const {
    action = "none",
    durationMs = 800,
    easing = "ease-in-out",
    offset,
    highlight = true,
    toValue,
    toElementId,
  } = options;

  const target = document.getElementById(id);
  if (!target) {
    console.warn(`[guideCursorTo] No element with id="${id}"`);
    return;
  }

  // Ensure on screen
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  await new Promise((r) => setTimeout(r, 180));

  const cursor = getOrCreateCursor();
  cursor.style.opacity = "1"; // show

  const from = {
    x: parseFloat(cursor.style.left || "20") || 20,
    y: parseFloat(cursor.style.top || "20") || 20,
  };
  const to = applyOffset(getCenterPoint(target), offset);

  await animatePosition(cursor, from, to, durationMs, easing);

  // Optional highlight pulse on target
  if (highlight) {
    (cursor as any).classList?.add("click");
    setTimeout(() => (cursor as any).classList?.remove("click"), 180);
  }

  // Perform action
  if (action === "click") {
    const p = getCenterPoint(target);
    dispatchMouseLike(target, "pointerdown", p);
    dispatchMouseLike(target, "mousedown", p);
    dispatchMouseLike(target, "mouseup", p);
    dispatchMouseLike(target, "click", p);
    if (target instanceof HTMLElement) target.focus?.();
  } else if (action === "drag") {
    const startPoint = getCenterPoint(target);
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
        // small delay to make it visible
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, Math.max(4, durationMs / steps / 2)));
      }
    } else {
      // Generic drag animation: move fake cursor then send move events
      await animatePosition(cursor, startPoint, endPoint, Math.max(300, durationMs * 0.6), easing);
      dispatchMouseLike(target, "pointermove", endPoint);
      dispatchMouseLike(target, "mousemove", endPoint);
    }

    dispatchMouseLike(target, "pointerup", endPoint);
    dispatchMouseLike(target, "mouseup", endPoint);
  }

  // Optionally hide cursor after a while
  setTimeout(() => {
    cursor.style.opacity = "0.9"; // keep visible but subtle
  }, 250);
}

// Expose globally for easy manual triggering in console if needed
if (typeof window !== "undefined") {
  // @ts-ignore
  (window as any).guideCursorTo = guideCursorTo;
}

export default function DemoPage() {
  const [rangeValue, setRangeValue] = useState(20);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("us");

  return (
    <main className="min-h-dvh p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Interactive Demo</h1>
      <p className="text-sm opacity-80 mb-6">
        This page includes various inputs and a programmable fake cursor. Use the
        demo buttons to see it move, click, and drag. Try the route at <code>/demo</code>.
      </p>

      <section className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <label htmlFor="nameInput" className="block text-sm mb-1">
              Name
            </label>
            <input
              id="nameInput"
              className="w-full rounded-md border border-neutral-300 bg-background text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="emailInput" className="block text-sm mb-1">
              Email
            </label>
            <input
              id="emailInput"
              type="email"
              className="w-full rounded-md border border-neutral-300 bg-background text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="passwordInput" className="block text-sm mb-1">
              Password
            </label>
            <input
              id="passwordInput"
              type="password"
              className="w-full rounded-md border border-neutral-300 bg-background text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="bioInput" className="block text-sm mb-1">
              Bio
            </label>
            <textarea
              id="bioInput"
              className="w-full rounded-md border border-neutral-300 bg-background text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Short description..."
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2">
              <input id="newsletterCheck" type="checkbox" className="size-4" />
              <span className="text-sm">Subscribe</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input id="agreeCheck" type="checkbox" className="size-4" />
              <span className="text-sm">Agree to terms</span>
            </label>
          </div>

          <div className="flex items-center gap-6">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="role" id="roleUser" className="size-4" defaultChecked />
              <span className="text-sm">User</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="role" id="roleAdmin" className="size-4" />
              <span className="text-sm">Admin</span>
            </label>
          </div>

          <div>
            <label htmlFor="countrySelect" className="block text-sm mb-1">
              Country
            </label>
            <select
              id="countrySelect"
              className="w-full rounded-md border border-neutral-300 bg-background text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="us">United States</option>
              <option value="uk">United Kingdom</option>
              <option value="sa">Saudi Arabia</option>
              <option value="de">Germany</option>
            </select>
          </div>

          <div>
            <label htmlFor="volumeSlider" className="block text-sm mb-1">
              Volume: <span className="font-mono">{Math.round(rangeValue)}</span>
            </label>
            <input
              id="volumeSlider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={rangeValue}
              onChange={(e) => setRangeValue(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex gap-3">
            <button
              id="submitBtn"
              className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 active:scale-[0.99]"
              onClick={() => alert(`Submitted: ${name || "(no name)"}, ${email || "(no email)"}`)}
            >
              Submit
            </button>
            <button
              id="resetBtn"
              className="rounded-md bg-neutral-200 text-neutral-900 px-4 py-2 hover:bg-neutral-300 active:scale-[0.99]"
              onClick={() => {
                setName("");
                setEmail("");
                setCountry("us");
                setRangeValue(20);
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-medium">Cursor Demos</h2>
          <p className="text-sm opacity-80">Click a demo to watch the cursor move and act.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("nameInput", { action: "click" })}
            >
              Focus Name (click)
            </button>
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("emailInput", { action: "click" })}
            >
              Focus Email (click)
            </button>
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("countrySelect", { action: "click" })}
            >
              Open Country Select (click)
            </button>
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("submitBtn", { action: "click" })}
            >
              Click Submit
            </button>
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("volumeSlider", { action: "drag", toValue: 80 })}
            >
              Drag Volume to 80
            </button>
            <button
              className="rounded-md border px-3 py-2 hover:bg-neutral-100"
              onClick={() => guideCursorTo("volumeSlider", { action: "drag", toValue: 10 })}
            >
              Drag Volume to 10
            </button>
          </div>
          <p className="text-xs opacity-70">
            You can also call <code>window.guideCursorTo(id, options)</code> from the browser console.
          </p>
        </div>
      </section>
    </main>
  );
}
