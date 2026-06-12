/**
 * Curated computed-style extractor for the assistant's element-pick.
 *
 * Returns only the handful of properties that matter when explaining why an
 * element looks the way it does (color, spacing, typography, layout). Values
 * come from getComputedStyle so they're already resolved to concrete
 * rgb()/px — no var()/color-mix ambiguity for the backend agent to untangle.
 */

const CURATED_PROPS = [
  "color",
  "background-color",
  "background-image",
  "border-color",
  "border-width",
  "border-style",
  "border-radius",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "display",
  "flex-direction",
  "align-items",
  "justify-content",
  "gap",
  "width",
  "height",
  "box-shadow",
  "opacity",
  "position",
  "z-index",
] as const;

export type CapturedStyles = Record<string, string>;

export function captureComputedStyles(el: Element): CapturedStyles {
  const cs = window.getComputedStyle(el);
  const out: CapturedStyles = {};
  for (const prop of CURATED_PROPS) {
    const value = cs.getPropertyValue(prop);
    if (value && value !== "none" && value !== "normal") {
      out[prop] = value.trim();
    }
  }
  return out;
}
