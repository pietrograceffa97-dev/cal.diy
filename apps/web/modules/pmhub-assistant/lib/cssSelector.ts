/**
 * Hand-rolled stable CSS selector generator — no dependency.
 *
 * Walks from the target element up toward <body>, preferring the most stable
 * single-attribute anchors (data-testid > id > name > aria-label) and falling
 * back to a couple of classes + :nth-of-type. Stops as soon as the accumulated
 * selector is unique in the document, so selectors stay as short as possible.
 *
 * Used by the PM Hub assistant's element-pick so the backend agent can be told
 * exactly which cal.diy element the tester clicked ("why is THIS button blue?").
 */

// Cross-realm-safe element check. `instanceof Element` is false across realms
// (memory reference_iframe_cross_realm_instanceof); duck-type via nodeType.
function isElement(node: unknown): node is Element {
  return !!node && (node as Node).nodeType === 1;
}

function cssIdentEscape(value: string): string {
  const CSSRef = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS;
  if (typeof CSSRef?.escape === "function") return CSSRef.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

function cssAttrEscape(value: string): string {
  return value.replace(/(["\\])/g, "\\$1");
}

function nthOfType(el: Element): number {
  let i = 1;
  let sib = el.previousElementSibling;
  while (sib) {
    if (sib.tagName === el.tagName) i++;
    sib = sib.previousElementSibling;
  }
  return i;
}

function segmentFor(el: Element): string {
  const tag = el.tagName.toLowerCase();

  const testid = el.getAttribute("data-testid");
  if (testid) return `${tag}[data-testid="${cssAttrEscape(testid)}"]`;

  const id = el.getAttribute("id");
  if (id && /^[A-Za-z][\w-]*$/.test(id)) return `${tag}#${cssIdentEscape(id)}`;

  const name = el.getAttribute("name");
  if (name) return `${tag}[name="${cssAttrEscape(name)}"]`;

  const aria = el.getAttribute("aria-label");
  if (aria) return `${tag}[aria-label="${cssAttrEscape(aria)}"]`;

  // Fall back to a small, deterministic subset of classes + nth-of-type.
  const classes = Array.from(el.classList)
    .filter((c) => /^[A-Za-z]/.test(c))
    .slice(0, 2);
  const classSel = classes.map((c) => `.${cssIdentEscape(c)}`).join("");
  return `${tag}${classSel}:nth-of-type(${nthOfType(el)})`;
}

/** Build a stable, ideally-unique CSS selector for `target`. */
export function computeSelector(target: Element, doc: Document = document): string {
  if (!isElement(target)) return "";

  // Quick win: a document-unique id.
  const id = target.getAttribute("id");
  if (id && /^[A-Za-z][\w-]*$/.test(id)) {
    const sel = `#${cssIdentEscape(id)}`;
    try {
      if (doc.querySelectorAll(sel).length === 1) return sel;
    } catch {
      /* malformed — fall through to the walk */
    }
  }

  const parts: string[] = [];
  let el: Element | null = target;
  while (el && isElement(el) && el.tagName.toLowerCase() !== "html") {
    parts.unshift(segmentFor(el));
    const candidate = parts.join(" > ");
    try {
      if (doc.querySelectorAll(candidate).length === 1) return candidate;
    } catch {
      /* malformed selector — keep walking up */
    }
    if (el.tagName.toLowerCase() === "body") break;
    el = el.parentElement;
  }
  return parts.join(" > ");
}
