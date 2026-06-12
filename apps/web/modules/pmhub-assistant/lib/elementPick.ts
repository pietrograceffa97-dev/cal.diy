"use client";

import { captureComputedStyles, type CapturedStyles } from "./computedStyles";
import { computeSelector } from "./cssSelector";

/**
 * Interactive element-pick for the assistant. Lets the tester point at any
 * element on the live cal.diy page; returns its stable selector, curated
 * computed styles, truncated outerHTML and bounding rect — the context the
 * backend agent needs to answer "why is THIS button blue?" or to anchor a bug.
 *
 * Native to cal.diy (direct DOM access) — no iframe, no postMessage.
 */

export type PickedElement = {
  selector: string;
  outerHTML: string;
  truncated: boolean;
  computedStyles: CapturedStyles;
  rect: { x: number; y: number; width: number; height: number };
  route: string;
  tag: string;
  text: string;
};

export type ElementPickHandle = { cancel: () => void };

const OUTER_HTML_CAP = 6000;
const TEXT_CAP = 200;
const MAX_Z = "2147483646";

/**
 * Begin picking. Renders a crosshair veil that owns the cursor and a highlight
 * box that tracks the hovered element. Calls `onPicked` with the chosen element
 * on click, or `null` if the user presses Escape / cancels.
 */
export function startElementPick(onPicked: (el: PickedElement | null) => void): ElementPickHandle {
  if (typeof document === "undefined") {
    onPicked(null);
    return { cancel: () => {} };
  }

  const highlight = document.createElement("div");
  Object.assign(highlight.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: MAX_Z,
    border: "2px solid #6366f1",
    background: "rgba(99,102,241,0.12)",
    borderRadius: "3px",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.4)",
    transition: "top 60ms ease-out, left 60ms ease-out, width 60ms ease-out, height 60ms ease-out",
    top: "0px",
    left: "0px",
    width: "0px",
    height: "0px",
  } as Partial<CSSStyleDeclaration>);

  // Transparent veil sits above the page: owns the crosshair cursor and swallows
  // the click so the underlying cal.diy control never actually activates.
  const veil = document.createElement("div");
  Object.assign(veil.style, {
    position: "fixed",
    inset: "0px",
    zIndex: MAX_Z,
    cursor: "crosshair",
    background: "transparent",
  } as Partial<CSSStyleDeclaration>);

  let current: Element | null = null;
  let done = false;

  function elementUnder(x: number, y: number): Element | null {
    // Hide the veil for the hit-test, then restore it.
    veil.style.pointerEvents = "none";
    const el = document.elementFromPoint(x, y);
    veil.style.pointerEvents = "auto";
    if (!el || (el as Node).nodeType !== 1) return null;
    if (el === highlight || el === veil) return null;
    return el;
  }

  function onMove(e: MouseEvent) {
    const el = elementUnder(e.clientX, e.clientY);
    if (!el) return;
    current = el;
    const r = el.getBoundingClientRect();
    highlight.style.top = `${r.top}px`;
    highlight.style.left = `${r.left}px`;
    highlight.style.width = `${r.width}px`;
    highlight.style.height = `${r.height}px`;
  }

  function cleanup() {
    veil.removeEventListener("mousemove", onMove);
    veil.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    highlight.remove();
    veil.remove();
  }

  function finish(el: Element | null) {
    if (done) return;
    done = true;
    cleanup();
    if (!el) {
      onPicked(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const html = el.outerHTML ?? "";
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    onPicked({
      selector: computeSelector(el),
      outerHTML: html.length > OUTER_HTML_CAP ? html.slice(0, OUTER_HTML_CAP) : html,
      truncated: html.length > OUTER_HTML_CAP,
      computedStyles: captureComputedStyles(el),
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      route: window.location.pathname,
      tag: el.tagName.toLowerCase(),
      text: text.length > TEXT_CAP ? `${text.slice(0, TEXT_CAP)}…` : text,
    });
  }

  function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    finish(current ?? elementUnder(e.clientX, e.clientY));
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(null);
    }
  }

  document.body.appendChild(highlight);
  document.body.appendChild(veil);
  veil.addEventListener("mousemove", onMove);
  veil.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);

  return { cancel: () => finish(null) };
}
