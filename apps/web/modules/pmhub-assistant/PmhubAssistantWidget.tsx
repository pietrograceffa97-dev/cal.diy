"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { startElementPick, type PickedElement } from "./lib/elementPick";
import { pmhubGet, pmhubPost } from "./lib/pmhubClient";

/**
 * Document Picture-in-Picture is Chromium-only and not yet typed in lib.dom.
 * Declare the small surface we use locally (same shape PM Hub's QA pop-out uses).
 */
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(opts?: {
        width?: number;
        height?: number;
        disallowReturnToOpener?: boolean;
      }): Promise<Window>;
    };
  }
}

/**
 * Native Parallel assistant widget for cal.diy ("Parallel Assistant";
 * Parallel is the PM Hub app — internal identifiers keep the pmhub name).
 *
 * A chomping iridescent orb (bottom-right) that unfolds into a single-chat
 * panel. No tabs — the assistant reads what you type and routes it: walk a
 * **test case** (real Step-6 scenarios → flag a step → Fail Triage agent →
 * Jira sub-tasks), report a **bug** (free-text → Ad-hoc Bug agent → a Jira
 * Story under the epic), ask **why** something behaves the way it does, or
 * leave **feedback**. The three capabilities surface as suggested prompts.
 *
 * Test + bug flows call Parallel for real via cal.diy's same-origin proxy
 * (`/api/pmhub-assistant/*` → HMAC → Parallel `/api/embed/*`). Ask + feedback are
 * the approved interaction shell pending their backends (Phases 2–3).
 *
 * Deep link: Parallel's Step 6 "Open test URL" links carry
 * `?pmhub_qa_project=` + `?pmhub_qa_scenario=` — the widget auto-opens
 * straight into that scenario's walkthrough (one-shot per page load).
 *
 * Self-contained scoped CSS (`.pmha-*`, light/dark via cal.diy's `.dark`),
 * Geist + JetBrains Mono. The iridescent gradient is Parallel's brand signature.
 */

type Props = {
  enabled: boolean;
  projectId: string | null;
};

type Intent = "testrun" | "bug" | "ask" | "feedback" | "validation";

type ChatMsg =
  | { id: number; role: "user"; text: string; el: PickedElement | null }
  | {
      id: number;
      role: "bot";
      intent: Intent;
      el: PickedElement | null;
      text: string;
      route: string;
      /** Set when seeded by a `?pmhub_qa_scenario=` deep link — preselects that scenario in TestRunner. */
      scenarioId?: string;
    };

/** An open triage conversation — set when the tester flags a step; drives the slide-in pane. */
type TriageSession = {
  projectId: string;
  scenarioId: string;
  scenarioTitle: string;
  stepIndex: number;
  stepText: string;
};

const INTENT: Record<Intent, { label: string; icon: (size: number) => JSX.Element }> = {
  testrun: { label: "Test case", icon: (s) => <IconTest size={s} /> },
  bug: { label: "Bug report", icon: (s) => <IconBug size={s} /> },
  ask: { label: "Question", icon: (s) => <IconAsk size={s} /> },
  feedback: { label: "Feedback", icon: (s) => <IconFeedback size={s} /> },
  validation: { label: "Validation", icon: (s) => <IconValidation size={s} /> },
};

// Deliberately excludes "validation": this array is the "not this?" reclassify
// cycle (see reclassify). Validation is a deep-link-only mode, never reached by
// classifying typed text, so it must not be a cycle target.
const INTENT_ORDER: Intent[] = ["testrun", "bug", "ask", "feedback"];

/** In-page panel drag-to-resize bounds (px). No persistence — resets on reload. */
const PANEL_MIN_W = 320;
const PANEL_MIN_H = 420;
const PANEL_MAX_W = 720;

/**
 * How the "open in another page" button detaches the panel:
 *  - "window" → a normal resizable browser window (Gmail-compose pop-out style).
 *  - "pip"    → an always-on-top Document Picture-in-Picture floating window
 *               (YouTube mini-player style; Chromium-only, window.open fallback).
 * Both keep the live chat in sync (the panel is portaled into the new window).
 */
const POPOUT_STYLE: "window" | "pip" = "pip";

/** sessionStorage key for the project the assistant is bound to. */
const PROJECT_BIND_KEY = "pmhub-assistant.project";
/** Same id shape the preview overlay enforces — keeps crafted URLs out. */
const PROJECT_BIND_REGEX = /^[a-zA-Z0-9-]+$/;
/** Step 6 scenario ids are slugs; same crafted-URL guard as project ids. */
const SCENARIO_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

const SUGGESTIONS: { intent: Intent; send: string; title: string; sub: string }[] = [
  {
    intent: "bug",
    send: "Something on this page is broken",
    title: "Something on this page is broken",
    sub: "I’ll reproduce it, find the cause, and draft a fix ticket",
  },
  {
    intent: "ask",
    send: "Why does this behave the way it does?",
    title: "Why does this behave the way it does?",
    sub: "Point at an element and ask — grounded in code, Confluence & Jira",
  },
  {
    intent: "feedback",
    send: "I’ve got feedback on this flow",
    title: "I’ve got feedback on this flow",
    sub: "Lands on the Parallel Auto-improve board",
  },
];

/** Heuristic intent router — mirrors the backend classifier's first pass. */
function classify(raw: string): Intent {
  const t = raw.toLowerCase();
  if (/\b(test case|run a test|test this|walk ?through|scenario|qa|run the test|test the)\b/.test(t)) {
    return "testrun";
  }
  if (
    /\b(broke|broken|bug|crash|doesn'?t work|not working|isn'?t working|error|fails?|failing|wrong|can'?t|cannot|stuck|frozen|blank|nothing happens|404|500)\b/.test(
      t
    )
  ) {
    return "bug";
  }
  if (
    /\b(feedback|i think|i'?d (like|love)|would be (nice|great|good|better)|suggest|wish|it'?d be|love|hate|annoying|confusing|prefer|could you add|please add|missing)\b/.test(
      t
    )
  ) {
    return "feedback";
  }
  return "ask";
}

function elColor(el: PickedElement | null): string {
  return el?.computedStyles["background-color"] ?? "transparent";
}

function toElementContext(el: PickedElement | null) {
  if (!el) return undefined;
  return {
    selector: el.selector,
    tag: el.tag,
    text: el.text,
    computedStyles: el.computedStyles,
    outerHTML: el.outerHTML,
  };
}

export default function PmhubAssistantWidget({ enabled, projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [route, setRoute] = useState("");
  const [hiddenForOverlay, setHiddenForOverlay] = useState(false);

  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [pendingEl, setPendingEl] = useState<PickedElement | null>(null);
  const [triageSession, setTriageSession] = useState<TriageSession | null>(null);

  // --- floating-window (Document PiP / popup) state ---
  // null = rendered in-page; a Window = popped out into a floating window.
  const [popWindow, setPopWindow] = useState<Window | null>(null);
  const [pipSupported, setPipSupported] = useState(false);

  // --- drag-to-move (in-page) ---
  // null until the first drag, then inline {left,top}px overriding bottom/right.
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, left: 0, top: 0 });

  // --- drag-to-resize (in-page) ---
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const resizeStartRef = useRef({ pointerX: 0, pointerY: 0, w: 0, h: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  const poppedOut = popWindow !== null;

  // The project the assistant acts on behalf of. Resolution order:
  // `?pmhub_qa_project=` URL param (Parallel's QA "Open test URL" links carry
  // it) → sessionStorage (sticky across in-session navigation) → the
  // NEXT_PUBLIC_PMHUB_PROJECT_ID env default passed as the projectId prop.
  // When all three are empty the panel opens with a project picker fed by
  // Parallel's /api/embed/projects.
  const [boundId, setBoundId] = useState<string | null>(null);
  const [pickingProject, setPickingProject] = useState(false);

  const idRef = useRef(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Guards the `?pmhub_qa_scenario=` auto-open so it fires once per page
  // load (also covers StrictMode's double effect run). Minimizing the
  // panel afterwards stays minimized — no re-nagging.
  const autoOpenedRef = useRef(false);
  // While a deep-linked test case is the only thing on screen, keep the
  // chat pinned to the top (so the tester sees the title + step 01, not
  // the tail of a tall walkthrough). Cleared the moment the tester sends
  // their own message, restoring normal bottom-follow.
  const pinTopRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setHiddenForOverlay(params.has("pmhub_project_id"));
    setRoute(window.location.pathname);
    setPipSupported(!!window.documentPictureInPicture);
    const fromUrl = params.get("pmhub_qa_project");
    const valid = fromUrl && PROJECT_BIND_REGEX.test(fromUrl) ? fromUrl : null;
    if (valid) window.sessionStorage.setItem(PROJECT_BIND_KEY, valid);
    const resolved = valid ?? window.sessionStorage.getItem(PROJECT_BIND_KEY) ?? projectId;
    setBoundId(resolved);

    // Deep link from Parallel's Step 6 "Open test URL": auto-open the
    // panel straight into that scenario's walkthrough. Requires a bound
    // project (the QA links always carry both params); the scenario is a
    // one-shot — it's deliberately NOT persisted to sessionStorage.
    const rawScenario = params.get("pmhub_qa_scenario");
    const scenarioId = rawScenario && SCENARIO_ID_REGEX.test(rawScenario) ? rawScenario : null;
    if (scenarioId && resolved && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      pinTopRef.current = true;
      setOpen(true);
      setMsgs((m) =>
        m.length > 0
          ? m
          : [
              {
                id: (idRef.current += 1),
                role: "bot",
                intent: "testrun",
                el: null,
                text: "Walk this test case",
                route: window.location.pathname,
                scenarioId,
              },
            ]
      );
    }

    // Deep link from Parallel's "Share for validation": auto-open straight into
    // the per-page validation checklist. One-shot per page load (shares
    // autoOpenedRef with the scenario link — the two link types never co-occur),
    // deliberately NOT persisted to sessionStorage.
    if (params.get("pmhub_qa_validation") === "1" && resolved && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      pinTopRef.current = true;
      setOpen(true);
      setMsgs((m) =>
        m.length > 0
          ? m
          : [
              {
                id: (idRef.current += 1),
                role: "bot",
                intent: "validation",
                el: null,
                text: "Validate this design",
                route: window.location.pathname,
              },
            ]
      );
    }
  }, [projectId]);

  // Keep `route` current as the stakeholder/PM navigates cal.diy's SPA, so each
  // new bot message — and the live validation checklist — is tagged to the page
  // actually on screen. window.location is read once on mount above; Next's
  // client router navigates via pushState/replaceState (no full reload), so we
  // patch both plus popstate to re-read the path.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setRoute(window.location.pathname);
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function (...args) {
      origPush.apply(this, args as Parameters<typeof origPush>);
      sync();
    };
    window.history.replaceState = function (...args) {
      origReplace.apply(this, args as Parameters<typeof origReplace>);
      sync();
    };
    window.addEventListener("popstate", sync);
    return () => {
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
      window.removeEventListener("popstate", sync);
    };
  }, []);

  function bindProject(id: string) {
    window.sessionStorage.setItem(PROJECT_BIND_KEY, id);
    // A thread is project-scoped. Already-rendered flows (TestRunner,
    // triage) fetch once per mount, so they'd silently keep acting on the
    // previous project — reset the thread instead of leaving stale cards.
    if (boundId && id !== boundId) resetChat();
    setBoundId(id);
    setPickingProject(false);
  }

  const scrollToBottom = useCallback(() => {
    const c = chatRef.current;
    if (!c) return;
    requestAnimationFrame(() => {
      c.scrollTop = c.scrollHeight;
    });
  }, []);

  // Deep-link landing: pin the chat to the TOP of the seeded test-case
  // card (scenario title + step 01) instead of following to the bottom.
  // A 9-step walkthrough is taller than the panel, so the default
  // bottom-follow would drop the tester at the last step.
  const scrollToTop = useCallback(() => {
    const c = chatRef.current;
    if (!c) return;
    requestAnimationFrame(() => {
      c.scrollTop = 0;
    });
  }, []);

  useEffect(() => {
    if (pinTopRef.current) scrollToTop();
    else scrollToBottom();
  }, [msgs, typing, scrollToBottom, scrollToTop]);

  // Drag-to-move: document-level pointer tracking so a fast drag that leaves
  // the header doesn't drop the gesture. Clamps the panel inside the viewport.
  useEffect(() => {
    if (!dragging) return;
    const panel = panelRef.current;
    const w = panel?.offsetWidth ?? 392;
    const h = panel?.offsetHeight ?? 640;
    const margin = 8;
    function move(ev: PointerEvent) {
      const s = dragStartRef.current;
      const nextLeft = s.left + (ev.clientX - s.pointerX);
      const nextTop = s.top + (ev.clientY - s.pointerY);
      const maxLeft = Math.max(margin, window.innerWidth - w - margin);
      const maxTop = Math.max(margin, window.innerHeight - h - margin);
      setDragPos({
        left: Math.min(Math.max(margin, nextLeft), maxLeft),
        top: Math.min(Math.max(margin, nextTop), maxTop),
      });
    }
    function up() {
      setDragging(false);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  // Drag-to-resize: same document-listener idiom; clamp to min/max + viewport.
  useEffect(() => {
    if (!resizing) return;
    function move(ev: PointerEvent) {
      const s = resizeStartRef.current;
      const maxH = window.innerHeight - 40;
      setSize({
        w: Math.min(Math.max(PANEL_MIN_W, s.w + (ev.clientX - s.pointerX)), PANEL_MAX_W),
        h: Math.min(Math.max(PANEL_MIN_H, s.h + (ev.clientY - s.pointerY)), maxH),
      });
    }
    function up() {
      setResizing(false);
    }
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  // Close any floating window if the widget unmounts (e.g. route change) so it
  // doesn't linger orphaned. The cleanup closes the *previous* popWindow value.
  useEffect(() => {
    return () => {
      if (popWindow && !popWindow.closed) popWindow.close();
    };
  }, [popWindow]);

  if (!enabled || hiddenForOverlay) return null;

  const nextId = () => (idRef.current += 1);

  function resizeInput() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 90)}px`;
  }

  function openPanel() {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function resetChat() {
    pinTopRef.current = false;
    setMsgs([]);
    setTyping(false);
    setPendingEl(null);
    setInput("");
    setTriageSession(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pushBot(intent: Intent, el: PickedElement | null, text: string) {
    setMsgs((m) => [...m, { id: nextId(), role: "bot", intent, el, text, route }]);
  }

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!boundId) {
      // Every flow files into a project — ask for one before routing.
      setPickingProject(true);
      return;
    }
    // The tester is driving now — resume normal bottom-follow.
    pinTopRef.current = false;
    const el = pendingEl;
    setMsgs((m) => [...m, { id: nextId(), role: "user", text: trimmed, el }]);
    setPendingEl(null);
    setInput("");
    requestAnimationFrame(resizeInput);

    const intent = classify(trimmed);
    // All intents (testrun / bug / ask / feedback) are real now — the bot
    // component handles its own loading state.
    pushBot(intent, el, trimmed);
  }

  function launchTestCase() {
    if (!open) openPanel();
    if (!boundId) {
      setPickingProject(true);
      return;
    }
    pinTopRef.current = false;
    pushBot("testrun", null, "Run a test case");
  }

  function reclassify(id: number) {
    setMsgs((m) =>
      m.map((x) =>
        x.id === id && x.role === "bot"
          ? { ...x, intent: INTENT_ORDER[(INTENT_ORDER.indexOf(x.intent) + 1) % INTENT_ORDER.length] }
          : x
      )
    );
  }

  function startPick() {
    setOpen(false);
    setPicking(true);
    startElementPick((el: PickedElement | null) => {
      setPicking(false);
      if (el) {
        setPendingEl(el);
        openPanel();
      } else {
        setOpen(true);
      }
    });
  }

  function onHeadPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (poppedOut) return; // header drag is meaningless in the floating window
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return; // let header icon buttons click
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, left: rect.left, top: rect.top };
    setDragPos({ left: rect.left, top: rect.top }); // pin to inline left/top (no jump — same rect)
    setDragging(true);
  }

  function onResizePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    // Pin the top-left to the current rect so the bottom-right grip grows
    // toward the cursor (otherwise a still-bottom-right-anchored panel would
    // expand up-left and the grip wouldn't follow). No-op if already dragged.
    setDragPos({ left: rect.left, top: rect.top });
    resizeStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, w: rect.width, h: rect.height };
    setSize({ w: rect.width, h: rect.height });
    setResizing(true);
  }

  function preparePopoutDoc(win: Window) {
    win.document.title = "Parallel Assistant";
    const b = win.document.body;
    b.style.margin = "0";
    b.style.height = "100vh";
    b.style.overflow = "hidden";
    // The widget's only external CSS dependency is the ancestor `.dark` class.
    if (document.documentElement.classList.contains("dark")) {
      win.document.documentElement.classList.add("dark");
    }
  }

  async function openPopout() {
    if (typeof window === "undefined") return;
    const w = 420;
    const h = 680;
    if (POPOUT_STYLE === "pip" && window.documentPictureInPicture) {
      try {
        const pip = await window.documentPictureInPicture.requestWindow({ width: w, height: h });
        preparePopoutDoc(pip);
        pip.addEventListener("pagehide", () => setPopWindow(null), { once: true });
        setOpen(true);
        setPopWindow(pip);
        return;
      } catch {
        /* fall through to a normal window */
      }
    }
    // Normal resizable browser window (Gmail-compose-style pop-out).
    const win = window.open("", "pmhub-assistant", `popup,width=${w},height=${h}`);
    if (!win) return; // popup blocked — stay in-page
    preparePopoutDoc(win);
    win.addEventListener("pagehide", () => setPopWindow(null), { once: true });
    setOpen(true);
    setPopWindow(win);
  }

  function bringBack() {
    if (popWindow && !popWindow.closed) popWindow.close(); // fires pagehide → setPopWindow(null)
    else setPopWindow(null);
  }

  // Renders the panel in-page, or portals it into the floating window when popped
  // out. The portal wraps the panel in `.pmha-root` so the widget's scoped CSS
  // variables + base font (all defined on `.pmha-root`) cascade in the new
  // document — without this wrapper the popout renders as unstyled black-on-white.
  function pmhaPortal(node: ReactNode) {
    if (!poppedOut || !popWindow) return node;
    return createPortal(<div className="pmha-root pmha-root--pip">{node}</div>, popWindow.document.body);
  }

  const showEmpty = msgs.length === 0 && !typing;

  return (
    <div className="pmha-root" data-testid="pmhub-assistant.root" style={{ display: picking ? "none" : undefined }}>
      <WidgetStyles />

      {!open && !poppedOut && (
        <button
          type="button"
          aria-label="Open Parallel assistant"
          data-testid="pmhub-assistant.bubble"
          onClick={openPanel}
          className="pmha-bubble pmha-grad">
          <span className="pmha-pac" aria-hidden />
        </button>
      )}

      {(open || poppedOut) &&
        pmhaPortal(
          <div
            ref={panelRef}
            className={`pmha-panel${poppedOut ? " pmha-panel--pip" : ""}`}
            data-testid="pmhub-assistant.panel"
            style={
              poppedOut
                ? undefined
                : {
                    ...(dragPos ? { left: dragPos.left, top: dragPos.top, right: "auto", bottom: "auto" } : null),
                    ...(size ? { width: size.w, height: size.h } : null),
                  }
            }>
            <WidgetStyles />
            <div className="pmha-thread pmha-grad" />

          <header className="pmha-head" onPointerDown={onHeadPointerDown}>
            <span className="pmha-orb pmha-grad">
              <span className="pmha-pac pmha-pac-sm" aria-hidden />
            </span>
            <div className="pmha-htxt">
              <div className="pmha-title">
                Parallel Assistant <span className="pmha-live" aria-hidden />
              </div>
              <div className="pmha-meta">
                {route || "/"}
                {" · "}
                <button
                  type="button"
                  className="pmha-projsw"
                  title={boundId ? "Switch project" : "Pick a project"}
                  data-testid="pmhub-assistant.project-switch"
                  onClick={() => setPickingProject((v) => !v)}>
                  {boundId ?? "pick a project"}
                </button>
              </div>
            </div>
            <button
              type="button"
              title={poppedOut ? "Bring back in-page" : "Open in another page"}
              aria-label={poppedOut ? "Bring back in-page" : "Open in another page"}
              data-testid="pmhub-assistant.popout"
              onClick={poppedOut ? bringBack : openPopout}
              className="pmha-icbtn">
              {poppedOut ? <IconBringBack size={15} /> : <IconExternal size={15} />}
            </button>
            <button
              type="button"
              title="New chat"
              aria-label="New chat"
              data-testid="pmhub-assistant.new-chat"
              onClick={resetChat}
              className="pmha-icbtn">
              <IconPlus size={15} />
            </button>
            {!poppedOut && (
              <button
                type="button"
                title="Minimize"
                aria-label="Minimize"
                data-testid="pmhub-assistant.minimize"
                onClick={() => setOpen(false)}
                className="pmha-icbtn">
                <IconChevronDown size={15} />
              </button>
            )}
          </header>

          <div className="pmha-slider">
            <div className={`pmha-track${triageSession ? " pmha-track-triage" : ""}`}>
              <div className="pmha-pane">
          <div className="pmha-chat" ref={chatRef}>
            {showEmpty && !boundId && (
              <div className="pmha-msg">
                <div className="pmha-hello">
                  Hi — I’m the <b>Parallel assistant</b>. First, which project is this session about? Everything
                  you report or test here files into it.
                </div>
                <ProjectPicker current={null} onPick={bindProject} />
              </div>
            )}

            {showEmpty && boundId && (
              <div className="pmha-msg">
                <div className="pmha-hello">
                  Hi — I’m the <b>Parallel assistant</b>. Tell me what’s up in your own words and I’ll work out
                  whether it’s a <b>test</b>, a <b>question</b>, or <b>feedback</b>.
                </div>
                <div className="pmha-suglabel">Try one of these</div>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.intent}
                    type="button"
                    className="pmha-sug"
                    data-testid={`pmhub-assistant.suggestion-${s.intent}`}
                    onClick={() => sendText(s.send)}>
                    <span className="pmha-tile">{INTENT[s.intent].icon(17)}</span>
                    <span className="pmha-t">
                      {s.title}
                      <small>{s.sub}</small>
                    </span>
                  </button>
                ))}
                <div className="pmha-hint">No menus, no tabs — just type. I’ll route it.</div>
              </div>
            )}

            {msgs.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="pmha-msg pmha-user">
                  {m.el && (
                    <div className="pmha-elchip" style={{ marginBottom: 6 }}>
                      <span className="pmha-sw" style={{ background: elColor(m.el) }} />
                      {m.el.selector}
                    </div>
                  )}
                  <div className="pmha-bub">{m.text}</div>
                </div>
              ) : (
                <BotMessage
                  key={m.id}
                  intent={m.intent}
                  el={m.el}
                  text={m.text}
                  route={m.route}
                  liveRoute={route}
                  projectId={boundId}
                  scenarioId={m.scenarioId ?? null}
                  onReclassify={() => reclassify(m.id)}
                  onFlag={setTriageSession}
                  scrollToBottom={scrollToBottom}
                  scrollToTop={scrollToTop}
                />
              )
            )}

            {pickingProject && (boundId || !showEmpty) && (
              <div className="pmha-msg">
                <ProjectPicker current={boundId} onPick={bindProject} scrollToBottom={scrollToBottom} />
              </div>
            )}

            {typing && (
              <div className="pmha-msg pmha-bot">
                <div className="pmha-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          <div className="pmha-composer">
            {pendingEl && (
              <div className="pmha-attached">
                <div className="pmha-elchip">
                  <span className="pmha-sw" style={{ background: elColor(pendingEl) }} />
                  {pendingEl.selector}
                </div>
                <button
                  type="button"
                  aria-label="Remove element"
                  className="pmha-icbtn pmha-icbtn-xs"
                  onClick={() => setPendingEl(null)}>
                  ×
                </button>
              </div>
            )}
            <div className="pmha-inputrow">
              <textarea
                ref={inputRef}
                rows={1}
                className="pmha-input"
                data-testid="pmhub-assistant.input"
                placeholder={boundId ? "Run a test, ask why, or share feedback…" : "Pick a project to get started…"}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  resizeInput();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    sendText(input);
                  }
                }}
              />
              <button
                type="button"
                aria-label="Send"
                data-testid="pmhub-assistant.send"
                className="pmha-sendbtn pmha-grad"
                disabled={!input.trim() || !boundId}
                onClick={() => sendText(input)}>
                <IconSend size={16} />
              </button>
            </div>
            <div className="pmha-ctools">
              <button
                type="button"
                className="pmha-pe"
                data-testid="pmhub-assistant.run-test"
                onClick={launchTestCase}>
                <IconTest size={13} />
                Run a test case
              </button>
              <button
                type="button"
                className="pmha-pe"
                data-testid="pmhub-assistant.point-element"
                onClick={startPick}
                disabled={poppedOut}
                title={poppedOut ? "Bring the assistant back in-page to point at an element" : undefined}>
                <IconCrosshair size={13} />
                Point at an element
              </button>
            </div>
          </div>
              </div>
              <div className="pmha-pane">
                {triageSession && (
                  <TriageChat session={triageSession} onBack={() => setTriageSession(null)} />
                )}
              </div>
            </div>
          </div>

            {!poppedOut && (
              <div
                className="pmha-resize"
                data-testid="pmhub-assistant.resize"
                onPointerDown={onResizePointerDown}
                aria-hidden
              />
            )}
        </div>,
        )}

      {poppedOut && (
        <button
          type="button"
          className="pmha-chip pmha-grad"
          data-testid="pmhub-assistant.bring-back"
          onClick={bringBack}
          title="Bring the assistant back into this page">
          <span className="pmha-pac pmha-pac-sm" aria-hidden />
          Assistant is in a floating window · Bring back
        </button>
      )}
    </div>
  );
}

/* ------------------------------ bot message ------------------------------ */

function BotMessage({
  intent,
  el,
  text,
  route,
  liveRoute,
  projectId,
  scenarioId,
  onReclassify,
  onFlag,
  scrollToBottom,
  scrollToTop,
}: {
  intent: Intent;
  el: PickedElement | null;
  text: string;
  route: string;
  /** The page currently on screen (updated on SPA nav) — validation tags to this, not the stamped `route`. */
  liveRoute?: string;
  projectId: string | null;
  /** Deep-linked scenario (from `?pmhub_qa_scenario=`) — seeded, not classified from typed text. */
  scenarioId?: string | null;
  onReclassify: () => void;
  onFlag: (session: TriageSession) => void;
  scrollToBottom: () => void;
  scrollToTop?: () => void;
}) {
  const meta = INTENT[intent];
  const ref = el ? (
    <>
      {" "}
      on <code>{el.selector}</code>
    </>
  ) : null;

  return (
    <div className="pmha-msg pmha-bot">
      <div className="pmha-intent">
        <span className="pmha-pill">
          {meta.icon(12)} {meta.label}
        </span>
        {scenarioId || intent === "validation" ? (
          <span>linked from Parallel</span>
        ) : (
          <>
            <span>detected</span> ·{" "}
            <button type="button" className="pmha-link" onClick={onReclassify}>
              not this?
            </button>
          </>
        )}
      </div>

      {intent === "testrun" && (
        <TestRunner
          projectId={projectId}
          initialScenarioId={scenarioId ?? null}
          onFlag={onFlag}
          scrollToBottom={scrollToBottom}
          scrollToTop={scrollToTop}
        />
      )}

      {intent === "bug" && (
        <BugBody
          projectId={projectId}
          description={text}
          route={route}
          el={el}
          scrollToBottom={scrollToBottom}
        />
      )}

      {intent === "ask" && (
        <AskBody
          question={text}
          route={route}
          el={el}
          projectId={projectId}
          scrollToBottom={scrollToBottom}
        />
      )}

      {intent === "feedback" && (
        <FeedbackBody
          text={text}
          route={route}
          el={el}
          projectId={projectId}
          scrollToBottom={scrollToBottom}
        />
      )}

      {intent === "validation" && (
        <ValidationRunner
          projectId={projectId}
          route={liveRoute ?? route}
          scrollToBottom={scrollToBottom}
        />
      )}
    </div>
  );
}

/* ------------------------------ ask flow (real) ------------------------------ */

type AskStatus = "pending" | "answered" | "errored";

function AskBody({
  question,
  route,
  el,
  projectId,
  scrollToBottom,
}: {
  question: string;
  route: string;
  el: PickedElement | null;
  projectId: string | null;
  scrollToBottom: () => void;
}) {
  const [phase, setPhase] = useState<"loading" | "answered" | "error">("loading");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [via, setVia] = useState<"relay" | "cloud" | null>(null);
  const ranRef = useRef(false);

  // Fire once. Mirrors BugBody's ranRef pattern (no cleanup/cancellation): under
  // React StrictMode's dev double-invoke, a cleanup that flips a `cancelled` flag
  // would kill the mount-1 poll loop while the ranRef guard blocks mount-2 from
  // restarting it — leaving the widget stuck on "Thinking…". setState after a real
  // unmount is a benign no-op, so we don't guard it.
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      const submit = await pmhubPost<{ ok: boolean; id: string; dispatched: "relay" | "cloud" }>("ask", {
        question,
        projectId,
        route,
        element: toElementContext(el),
      });
      if (!submit.ok || !submit.data?.id) {
        setError(submit.ok ? "The assistant didn’t accept the question." : submit.error);
        setPhase("error");
        scrollToBottom();
        return;
      }
      setVia(submit.data.dispatched);
      const id = submit.data.id;

      // Poll up to ~120s for the async answer (relay $0 / cloud Sonnet).
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1800));
        const poll = await pmhubGet<{ status: AskStatus; answer: string | null; error: string | null }>(
          `ask/${id}`
        );
        if (!poll.ok) continue; // transient — keep polling
        const st = poll.data?.status;
        if (st === "answered") {
          setAnswer(poll.data?.answer ?? "");
          setPhase("answered");
          scrollToBottom();
          return;
        }
        if (st === "errored") {
          setError(poll.data?.error ?? "The assistant hit an error.");
          setPhase("error");
          scrollToBottom();
          return;
        }
      }
      setError("Timed out waiting for an answer — try again.");
      setPhase("error");
      scrollToBottom();
    })();
  }, [question, projectId, route, el, scrollToBottom]);

  if (phase === "loading") {
    return (
      <div className="pmha-bub" data-testid="pmhub-assistant.ask.loading">
        {via === "relay" ? "Answering on Claude Code…" : "Thinking…"}
        <div className="pmha-askmeta">grounded in Confluence · Jira · the cal.diy design system</div>
        <div className="pmha-typing" style={{ marginTop: 8 }}>
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="pmha-bub" data-testid="pmhub-assistant.ask.error">
        I couldn’t answer that: {error}
      </div>
    );
  }

  return (
    <div className="pmha-bub pmha-answer" data-testid="pmhub-assistant.ask.answer">
      <Markish text={answer} />
    </div>
  );
}

/** Minimal, dependency-free markdown renderer: blank-line paragraphs, `- ` bullets,
 *  inline **bold** + `code`. No HTML injection — everything is React nodes. */
function Markish({ text }: { text: string }) {
  const out: JSX.Element[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    out.push(
      <ul key={`ul-${out.length}`} className="pmha-mdul">
        {items.map((b, i) => (
          <li key={i}>{inlineMd(b)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();
    if (line.trim() === "") {
      out.push(<div key={`sp-${out.length}`} className="pmha-mdsp" />);
    } else {
      out.push(
        <p key={`p-${out.length}`} className="pmha-mdp">
          {inlineMd(line)}
        </p>
      );
    }
  }
  flushBullets();
  return <>{out}</>;
}

function inlineMd(s: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  // **bold** before *italic* (so `**` isn't mis-read as two `*`); then `code`.
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<b key={key++}>{tok.slice(2, -2)}</b>);
    else if (tok.startsWith("*")) parts.push(<i key={key++}>{tok.slice(1, -1)}</i>);
    else parts.push(<code key={key++}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

/* ------------------------------ feedback flow (real) ------------------------------ */

function FeedbackBody({
  text,
  route,
  el,
  projectId,
  scrollToBottom,
}: {
  text: string;
  route: string;
  el: PickedElement | null;
  projectId: string | null;
  scrollToBottom: () => void;
}) {
  const [phase, setPhase] = useState<"sending" | "sent" | "error">("sending");
  const [error, setError] = useState("");
  const ranRef = useRef(false);

  // Fire once (no cleanup/cancel) — see AskBody for the StrictMode rationale.
  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      const res = await pmhubPost<{ ok: boolean; id: string }>("feedback", {
        text,
        projectId,
        route,
        element: el ? { selector: el.selector, tag: el.tag, text: el.text } : undefined,
      });
      if (res.ok && res.data?.ok) {
        setPhase("sent");
      } else {
        setError(res.ok ? "I couldn’t save that." : res.error);
        setPhase("error");
      }
      scrollToBottom();
    })();
  }, [text, projectId, route, el, scrollToBottom]);

  if (phase === "sending") {
    return (
      <div className="pmha-bub" data-testid="pmhub-assistant.feedback.sending">
        Logging your feedback…
      </div>
    );
  }
  if (phase === "error") {
    return (
      <div className="pmha-bub" data-testid="pmhub-assistant.feedback.error">
        I couldn’t log that: {error}
      </div>
    );
  }
  return (
    <div className="pmha-bub" data-testid="pmhub-assistant.feedback.sent">
      Logged to the <b>Auto-improve board</b> ✓ — thanks. The PM reviews these for what to fix next.
    </div>
  );
}

/* ------------------------------ bug flow (real) ------------------------------ */

type AdhocProposal = {
  title: string;
  description: string;
  acceptance_criteria: string[];
  claude_code_prompt: string;
};

function BugBody({
  projectId,
  description,
  route,
  el,
  scrollToBottom,
}: {
  projectId: string | null;
  description: string;
  route: string;
  el: PickedElement | null;
  scrollToBottom: () => void;
}) {
  const [phase, setPhase] = useState<"composing" | "ready" | "error">("composing");
  const [proposal, setProposal] = useState<AdhocProposal | null>(null);
  const [error, setError] = useState<string>("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!projectId) {
      setError(
        "No Parallel project is connected to this page, so I can’t file a ticket. Ask your PM to bind one."
      );
      setPhase("error");
      return;
    }
    (async () => {
      const res = await pmhubPost<{ ok: boolean; proposal: AdhocProposal }>("adhoc-bug/compose", {
        projectId,
        description,
        route,
        element: toElementContext(el),
      });
      if (res.ok && res.data?.proposal) {
        setProposal(res.data.proposal);
        setPhase("ready");
      } else {
        setError(res.ok ? "The agent returned an empty proposal." : res.error);
        setPhase("error");
      }
      scrollToBottom();
    })();
  }, [projectId, description, route, el, scrollToBottom]);

  if (phase === "composing") {
    return (
      <div className="pmha-bub">
        Reproducing and drafting a fix…
        <div className="pmha-typing" style={{ marginTop: 8 }}>
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return <div className="pmha-bub">I couldn’t draft a ticket: {error}</div>;
  }

  if (!proposal) return null;
  return (
    <div className="pmha-bub">
      I reproduced it and traced the likely cause. Here’s a fix ticket:
      <AdhocProposalCard
        projectId={projectId!}
        proposal={proposal}
        route={route}
        selector={el?.selector}
        scrollToBottom={scrollToBottom}
      />
    </div>
  );
}

function AdhocProposalCard({
  projectId,
  proposal,
  route,
  selector,
  scrollToBottom,
}: {
  projectId: string;
  proposal: AdhocProposal;
  route: string;
  selector?: string;
  scrollToBottom: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "creating" | { key: string; url: string } | { error: string }>("idle");

  async function create() {
    setStatus("creating");
    const res = await pmhubPost<{ ok: boolean; created_key: string; created_url: string }>("adhoc-bug/apply", {
      projectId,
      title: proposal.title,
      description: proposal.description,
      acceptance_criteria: proposal.acceptance_criteria,
      claude_code_prompt: proposal.claude_code_prompt,
      route,
      selector,
    });
    if (res.ok && res.data?.created_key) {
      setStatus({ key: res.data.created_key, url: res.data.created_url });
    } else {
      setStatus({ error: res.ok ? "Apply returned no ticket key." : res.error });
    }
    scrollToBottom();
  }

  return (
    <div className="pmha-pcard">
      <div className="pmha-lbl">
        <IconFlag size={11} /> Proposed fix · Jira story
      </div>
      <h4>{proposal.title}</h4>
      <ul>
        {proposal.acceptance_criteria.slice(0, 4).map((ac, i) => (
          <li key={i}>{ac}</li>
        ))}
      </ul>
      {typeof status === "object" && "key" in status ? (
        <div className="pmha-ok">
          <IconCheck size={15} /> Created{" "}
          {status.url ? (
            <a href={status.url} target="_blank" rel="noreferrer" className="pmha-link">
              {status.key}
            </a>
          ) : (
            <b>{status.key}</b>
          )}{" "}
          under the epic
        </div>
      ) : typeof status === "object" && "error" in status ? (
        <div className="pmha-bub" style={{ marginTop: 8, padding: 0, background: "transparent" }}>
          Couldn’t create the ticket: {status.error}
        </div>
      ) : (
        <div className="pmha-act">
          <button type="button" className="pmha-btn pmha-prim" disabled={status === "creating"} onClick={create}>
            {status === "creating" ? "Creating…" : "Create Jira ticket"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ test runner (real) ------------------------------ */

type EmbedScenario = {
  id: string;
  title: string;
  preconditions: string | null;
  steps: string[];
  expected: string;
  edge_cases: string[];
  execution: { result: string; triage_status: string | null; has_proposal: boolean } | null;
};

/* ----------------------------- project picker ---------------------------- */

type ProjectsResponse = {
  projects: { id: string; title: string; state: string }[];
};

/**
 * Lets the tester bind the assistant to a PM Hub project when the page URL
 * didn't carry `?pmhub_qa_project=` and no env default is configured — or
 * switch projects mid-session via the header affordance. Fed by PM Hub's
 * /api/embed/projects (in-QA projects sort first).
 */
function ProjectPicker({
  current,
  onPick,
  scrollToBottom,
}: {
  current: string | null;
  onPick: (id: string) => void;
  scrollToBottom?: () => void;
}) {
  const [projects, setProjects] = useState<ProjectsResponse["projects"] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await pmhubGet<ProjectsResponse>("projects");
      if (res.ok) setProjects(res.data.projects);
      else setError(res.error);
      scrollToBottom?.();
    })();
  }, [scrollToBottom]);

  if (error) return <div className="pmha-bub">I couldn’t load the project list: {error}</div>;
  if (!projects) {
    return (
      <div className="pmha-bub">
        Loading projects…
        <div className="pmha-typing" style={{ marginTop: 8 }}>
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }
  if (projects.length === 0) return <div className="pmha-bub">No active Parallel projects found.</div>;

  return (
    <div className="pmha-bub">
      {current ? "Switch to another project:" : "Pick the project to work on:"}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            className="pmha-btn"
            style={{ textAlign: "left" }}
            data-testid={`pmhub-assistant.project-${p.id}`}
            onClick={() => onPick(p.id)}>
            {p.title}{" "}
            <small style={{ opacity: 0.65 }}>
              · {p.state}
              {p.id === current ? " · current" : ""}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

type ScenariosResponse = {
  title: string;
  state: string;
  triageAvailable: boolean;
  hasEpic: boolean;
  scenarios: EmbedScenario[];
};

function TestRunner({
  projectId,
  initialScenarioId,
  onFlag,
  scrollToBottom,
  scrollToTop,
}: {
  projectId: string | null;
  /** Preselect this scenario after the plan loads (QA deep link). */
  initialScenarioId?: string | null;
  onFlag: (session: TriageSession) => void;
  scrollToBottom: () => void;
  /** Deep-link landing: pin to the top of the (tall) card instead of its tail. */
  scrollToTop?: () => void;
}) {
  const [data, setData] = useState<ScenariosResponse | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  // The deep link named a scenario that isn't in the loaded plan (stale
  // link after a re-generated test plan) — fall back to the picker, noted.
  const [linkedMissing, setLinkedMissing] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!projectId) {
      setError("No Parallel project is connected to this page. Ask your PM to bind one to run its test plan.");
      setPhase("error");
      return;
    }
    (async () => {
      const res = await pmhubGet<ScenariosResponse>("scenarios", { projectId });
      if (res.ok) {
        setData(res.data);
        const linked =
          initialScenarioId && res.data.scenarios.some((s) => s.id === initialScenarioId)
            ? initialScenarioId
            : null;
        if (linked) {
          setPickedId(linked);
        } else if (initialScenarioId) {
          // Stale deep link (plan re-generated since the PM's link) —
          // force the picker + hint instead of silently auto-walking a
          // scenario the link never named (the seeded card still says
          // "linked from Parallel", so an auto-pick would mislead).
          setLinkedMissing(true);
        } else if (res.data.scenarios.length === 1) {
          setPickedId(res.data.scenarios[0].id);
        }
        setPhase("ready");
      } else {
        setError(res.error);
        setPhase("error");
      }
      // A deep-linked card is tall (full walkthrough) — land the tester
      // at its top (title + step 01). Manual "Run a test case" keeps the
      // normal follow-to-bottom.
      if (initialScenarioId && scrollToTop) scrollToTop();
      else scrollToBottom();
    })();
  }, [projectId, initialScenarioId, scrollToBottom, scrollToTop]);

  if (phase === "loading") {
    return (
      <div className="pmha-bub">
        Loading the test plan…
        <div className="pmha-typing" style={{ marginTop: 8 }}>
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }
  if (phase === "error") {
    return <div className="pmha-bub">I couldn’t load scenarios: {error}</div>;
  }
  if (!data) return null;

  if (data.scenarios.length === 0) {
    return (
      <div className="pmha-bub">
        <b>{data.title}</b> has no test-plan scenarios yet (it’s in <code>{data.state}</code>). The Test Plan agent
        generates these in Step 6.
      </div>
    );
  }

  const scenario = data.scenarios.find((s) => s.id === pickedId) ?? null;

  if (!scenario) {
    // Multiple scenarios → let the tester pick which one to walk.
    return (
      <div className="pmha-bub">
        {linkedMissing && (
          <div className="pmha-hint" style={{ marginBottom: 8 }}>
            The linked test case isn’t in this project’s current plan — it may have been re-generated.
          </div>
        )}
        Pick a scenario to walk:
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {data.scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              className="pmha-btn"
              style={{ textAlign: "left" }}
              onClick={() => {
                setPickedId(s.id);
                scrollToBottom();
              }}>
              {s.title}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ScenarioRunner
      projectId={projectId!}
      scenario={scenario}
      triageAvailable={data.triageAvailable}
      onFlag={onFlag}
      scrollToBottom={scrollToBottom}
    />
  );
}

type TriageProposal = {
  summary: string;
  subtasks: Array<{ parent_story_key: string; title: string; acceptance_criteria: string[] }>;
};

type TriageMsg = { role: "user" | "assistant"; content: string };
type TriageRecord = { messages: TriageMsg[]; proposal?: TriageProposal; status: string };

/* ---------------- copyable step values ---------------- */

// Pull the concrete values a tester needs to paste into the app out of a step
// sentence: quoted literals (the test-plan convention for names/inputs), bare
// emails, and route/paths. Deduped, order-preserved.
const VALUE_PATTERNS: RegExp[] = [
  /'([^']{1,80})'/g, // single-quoted literal
  /"([^"]{1,80})"/g, // double-quoted literal
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, // email
  /\/[A-Za-z0-9][\w-]*(?:\/[\w%-]+)+/g, // route / path (≥2 segments)
];

function extractStepValues(text: string): string[] {
  const out: string[] = [];
  for (const re of VALUE_PATTERNS) {
    for (const m of Array.from(text.matchAll(re))) {
      const v = (m[1] ?? m[0]).trim();
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

function StepValues({ text }: { text: string }) {
  const values = extractStepValues(text);
  if (values.length === 0) return null;
  return (
    <div className="pmha-stepvals">
      {values.map((v) => (
        <CopyChip key={v} value={v} />
      ))}
    </div>
  );
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked (insecure context) — silently no-op */
    }
  }
  return (
    <button type="button" className="pmha-copychip" onClick={copy} title={`Copy "${value}"`}>
      {copied ? <IconCheck size={11} /> : <IconCopy size={11} />}
      <span className="pmha-copyval">{value}</span>
    </button>
  );
}

/* ---------------- dedicated triage chat (slide-in pane) ---------------- */

function TriageChat({ session, onBack }: { session: TriageSession; onBack: () => void }) {
  const [triage, setTriage] = useState<TriageRecord | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);
  const scrollBody = useCallback(() => {
    const c = bodyRef.current;
    if (c) requestAnimationFrame(() => (c.scrollTop = c.scrollHeight));
  }, []);
  useEffect(() => {
    scrollBody();
  }, [triage, busy, scrollBody]);

  async function send() {
    const message = answer.trim();
    if (!message) return;
    setBusy(true);
    setError("");
    const res = await pmhubPost<{ ok: boolean; triage: TriageRecord }>("triage", {
      projectId: session.projectId,
      scenarioId: session.scenarioId,
      message,
    });
    if (res.ok && res.data?.triage) {
      setTriage(res.data.triage);
      setAnswer("");
    } else {
      setError(res.ok ? "Triage returned no data." : res.error);
    }
    setBusy(false);
  }

  const hasThread = !!triage && triage.messages.length > 0;

  return (
    <div className="pmha-tchat">
      <div className="pmha-tchead">
        <button type="button" className="pmha-icbtn" aria-label="Back to test" onClick={onBack}>
          <IconChevronLeft size={16} />
        </button>
        <div className="pmha-tchtxt">
          <div className="pmha-tchtitle">Flag &amp; investigate</div>
          <div className="pmha-tchstep">
            step {session.stepIndex + 1} · {session.stepText}
          </div>
        </div>
      </div>

      <div className="pmha-tcbody" ref={bodyRef}>
        {hasThread &&
          triage!.messages.map((m, k) => (
            <div key={k} className={`pmha-tmsg ${m.role === "user" ? "pmha-tuser" : "pmha-tbot"}`}>
              {m.content}
            </div>
          ))}
        {busy && (
          <div className="pmha-typing">
            <span />
            <span />
            <span />
          </div>
        )}
        {error && (
          <div className="pmha-triage-lead" style={{ color: "var(--red)" }}>
            Triage failed: {error}
          </div>
        )}
        {triage?.proposal && (
          <TriageProposalCard
            projectId={session.projectId}
            scenarioId={session.scenarioId}
            proposal={triage.proposal}
            scrollToBottom={scrollBody}
          />
        )}
      </div>

      {!triage?.proposal && (
        <div className="pmha-composer">
          <div className="pmha-inputrow">
            <textarea
              ref={inputRef}
              rows={1}
              className="pmha-input"
              placeholder={hasThread ? "Answer the question…" : "Describe what went wrong on this step…"}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={busy}
            />
            <button
              type="button"
              aria-label="Send"
              className="pmha-sendbtn pmha-grad"
              disabled={!answer.trim() || busy}
              onClick={send}>
              <IconSend size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioRunner({
  projectId,
  scenario,
  triageAvailable,
  onFlag,
  scrollToBottom,
}: {
  projectId: string;
  scenario: EmbedScenario;
  triageAvailable: boolean;
  onFlag: (session: TriageSession) => void;
  scrollToBottom: () => void;
}) {
  const total = scenario.steps.length;
  const [passed, setPassed] = useState<boolean[]>(() => scenario.steps.map(() => false));
  const [flagged, setFlagged] = useState<Set<number>>(() => new Set());

  const done = passed.filter(Boolean).length;
  const allDone = done === total;

  useEffect(() => {
    if (allDone) scrollToBottom();
  }, [allDone, scrollToBottom]);

  function toggle(i: number) {
    setPassed((p) => p.map((v, j) => (j === i ? !v : v)));
  }
  // Flagging a step slides the panel into a dedicated triage chat (owned at the
  // widget level). The Fail execution is recorded server-side on the first
  // triage message, so flagging alone is a no-write intent signal.
  function flag(i: number) {
    setFlagged((f) => new Set(f).add(i));
    onFlag({
      projectId,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      stepIndex: i,
      stepText: scenario.steps[i],
    });
  }

  return (
    <div className="pmha-run">
      <div className="pmha-run-head">
        <div className="pmha-rt">
          <IconTest size={15} /> {scenario.title}
        </div>
        <span className="pmha-prog">
          {done} / {total}
        </span>
      </div>

      {scenario.steps.map((s, i) => {
        const isPassed = passed[i];
        return (
          <div
            key={i}
            className={`pmha-step${isPassed ? " pmha-passed" : ""}${flagged.has(i) ? " pmha-failed" : ""}`}>
            <button
              type="button"
              aria-label={isPassed ? "Mark step not passed" : "Mark step passed"}
              className="pmha-pass"
              onClick={() => toggle(i)}>
              <IconCheck size={13} />
            </button>
            <div className="pmha-step-main">
              <div className="pmha-step-txt">
                <span className="pmha-step-n">{String(i + 1).padStart(2, "0")}</span>
                {s}
              </div>
              <StepValues text={s} />
            </div>
            <button
              type="button"
              className="pmha-flag"
              onClick={() => flag(i)}
              disabled={!triageAvailable}
              title={triageAvailable ? "Flag this step & investigate" : "Triage only available in Build"}>
              <IconFlag size={12} /> Flag
            </button>
          </div>
        );
      })}

      {allDone && (
        <div className="pmha-run-done">
          <IconCheck size={15} /> Scenario passed — every step checked
        </div>
      )}
    </div>
  );
}

/* --------------------------- validation flow (real) --------------------------- */

type ValidationItem = {
  id: string;
  screen_route: string;
  variant_key: string;
  text: string;
  status: "pending" | "approved" | "flagged";
  flag_note?: string;
  resolved?: boolean;
  resolution_note?: string;
};

type ValidationComment = {
  id: string;
  screen_route: string;
  variant_key: string;
  body: string;
  kind: "comment" | "question";
  created_at: string;
  resolved: boolean;
  resolution_note?: string;
};

type ValidationScreen = {
  route: string;
  label: string;
  has_existing_design: boolean;
  variants: { key: string; label: string }[];
};

type ValidationResponse = {
  projectId: string;
  title: string;
  state: string;
  screens: ValidationScreen[];
  checklist: ValidationItem[];
  comments: ValidationComment[];
  shareCount: number;
};

/**
 * Stakeholder validation surface — the per-page checklist + comment composer the
 * auto-logged-in stakeholder reacts to. Mirrors TestRunner's fetch/phase shape,
 * but instead of a one-scenario walkthrough it shows every checklist item +
 * comment scoped to the page currently on screen (`route`, kept live by the
 * widget's SPA-route effect). Approve/flag + comments POST straight to Parallel
 * (the stakeholder's own input — no preview-and-approve).
 */
function ValidationRunner({
  projectId,
  route,
  scrollToBottom,
}: {
  projectId: string | null;
  route: string;
  scrollToBottom: () => void;
}) {
  const [data, setData] = useState<ValidationResponse | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [items, setItems] = useState<ValidationItem[]>([]);
  const [comments, setComments] = useState<ValidationComment[]>([]);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (!projectId) {
      setError("No Parallel project is connected to this page. Open the validation link your PM shared.");
      setPhase("error");
      return;
    }
    (async () => {
      const res = await pmhubGet<ValidationResponse>("validation", { projectId });
      if (res.ok) {
        setData(res.data);
        setItems(res.data.checklist);
        setComments(res.data.comments);
        setPhase("ready");
      } else {
        setError(res.error);
        setPhase("error");
      }
      scrollToBottom();
    })();
  }, [projectId, scrollToBottom]);

  if (phase === "loading") {
    return (
      <div className="pmha-bub" data-testid="pmhub-assistant.validation.loading">
        Loading the validation checklist…
        <div className="pmha-typing" style={{ marginTop: 8 }}>
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }
  if (phase === "error") {
    return (
      <div className="pmha-bub" data-testid="pmhub-assistant.validation.error">
        I couldn't load the checklist: {error}
      </div>
    );
  }
  if (!data) return null;

  const hasScreens = data.screens.length > 0;
  const screen = data.screens.find((s) => s.route === route) ?? null;
  const pageItems = hasScreens ? items.filter((it) => it.screen_route === route) : items;
  const pageComments = hasScreens ? comments.filter((c) => c.screen_route === route) : comments;
  const pageLabel = screen?.label ?? route;
  const currentVariant =
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("variant")
      : null) || "default";

  return (
    <div className="pmha-run" data-testid="pmhub-assistant.validation.runner">
      <div className="pmha-run-head">
        <div className="pmha-rt">
          <IconValidation size={15} /> Validate: {pageLabel}
        </div>
        <span className="pmha-prog">
          {pageItems.length} item{pageItems.length === 1 ? "" : "s"}
        </span>
      </div>

      {data.checklist.length === 0 && (
        <div className="pmha-hint">
          No checklist yet — leave a comment below, or your PM will share one shortly.
        </div>
      )}

      {hasScreens && data.checklist.length > 0 && pageItems.length === 0 && (
        <div className="pmha-hint">
          No checklist items for this page. Navigate to another screen, or leave a comment below.
        </div>
      )}

      {pageItems.map((it) => (
        <ValidationItemRow
          key={it.id}
          projectId={projectId!}
          item={it}
          onUpdated={(u) => setItems((arr) => arr.map((x) => (x.id === u.id ? u : x)))}
        />
      ))}

      {pageComments.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {pageComments.map((c) => (
            <div key={c.id} className="pmha-vcomment">
              <span className="pmha-pill">{c.kind === "question" ? "Question" : "Comment"}</span> {c.body}
              {c.resolved && c.resolution_note && (
                <div className="pmha-hint" style={{ marginTop: 4 }}>
                  ✓ PM resolved: {c.resolution_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ValidationComposer
        projectId={projectId!}
        screenRoute={screen?.route ?? route}
        variantKey={currentVariant}
        onPosted={(c) => {
          setComments((arr) => [...arr, c]);
          scrollToBottom();
        }}
      />
    </div>
  );
}

function ValidationItemRow({
  projectId,
  item,
  onUpdated,
}: {
  projectId: string;
  item: ValidationItem;
  onUpdated: (updated: ValidationItem) => void;
}) {
  const [flagging, setFlagging] = useState(false);
  const [note, setNote] = useState(item.flag_note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function respond(status: "approved" | "flagged", flag_note?: string) {
    setBusy(true);
    setErr("");
    const res = await pmhubPost<{ ok: boolean; item: ValidationItem }>("validation/respond", {
      projectId,
      itemId: item.id,
      status,
      flag_note,
    });
    setBusy(false);
    if (res.ok && res.data?.item) {
      onUpdated(res.data.item);
      setFlagging(false);
    } else {
      setErr(res.ok ? "Couldn't save that." : res.error);
    }
  }

  return (
    <div
      className={`pmha-step${item.status === "approved" ? " pmha-passed" : ""}${
        item.status === "flagged" ? " pmha-failed" : ""
      }`}>
      <button
        type="button"
        aria-label="Approve this item"
        className="pmha-pass"
        disabled={busy}
        onClick={() => respond("approved")}
        data-testid="pmhub-assistant.validation.approve">
        <IconCheck size={13} />
      </button>
      <div className="pmha-step-main">
        <div className="pmha-step-txt">{item.text}</div>
        {item.status !== "pending" && (
          <div className="pmha-hint" style={{ marginTop: 3 }}>
            {item.status === "approved" ? "Approved ✓" : "Flagged ⚑"}
            {item.flag_note ? ` — ${item.flag_note}` : ""}
          </div>
        )}
        {item.resolved && item.resolution_note && (
          <div className="pmha-hint" style={{ marginTop: 3 }}>
            ✓ PM resolved: {item.resolution_note}
          </div>
        )}
        {flagging && (
          <div className="pmha-inputrow" style={{ marginTop: 6 }}>
            <textarea
              className="pmha-input"
              placeholder="What's off? (optional)"
              value={note}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              data-testid="pmhub-assistant.validation.flag-note"
            />
            <button
              type="button"
              className="pmha-sendbtn pmha-grad"
              disabled={busy}
              onClick={() => respond("flagged", note.trim() || undefined)}>
              <IconSend size={15} />
            </button>
          </div>
        )}
        {err && (
          <div className="pmha-hint" style={{ marginTop: 3 }}>
            {err}
          </div>
        )}
      </div>
      <button
        type="button"
        className="pmha-flag"
        disabled={busy}
        onClick={() =>
          item.status === "flagged"
            ? respond("flagged", note.trim() || undefined)
            : setFlagging((v) => !v)
        }
        data-testid="pmhub-assistant.validation.flag">
        <IconFlag size={12} /> Flag
      </button>
    </div>
  );
}

function ValidationComposer({
  projectId,
  screenRoute,
  variantKey,
  onPosted,
}: {
  projectId: string;
  screenRoute: string;
  variantKey: string;
  onPosted: (comment: ValidationComment) => void;
}) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"comment" | "question">("comment");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setErr("");
    const res = await pmhubPost<{ ok: boolean; comment: ValidationComment }>("validation/comment", {
      projectId,
      screen_route: screenRoute,
      variant_key: variantKey,
      body: text,
      kind,
    });
    setBusy(false);
    if (res.ok && res.data?.comment) {
      setBody("");
      onPosted(res.data.comment);
    } else {
      setErr(res.ok ? "Couldn't post that." : res.error);
    }
  }

  return (
    <div className="pmha-vcomposer">
      <div className="pmha-vkinds">
        <button
          type="button"
          className="pmha-btn"
          style={{ opacity: kind === "comment" ? 1 : 0.5 }}
          onClick={() => setKind("comment")}>
          Comment
        </button>
        <button
          type="button"
          className="pmha-btn"
          style={{ opacity: kind === "question" ? 1 : 0.5 }}
          onClick={() => setKind("question")}>
          Question
        </button>
      </div>
      <div className="pmha-inputrow">
        <textarea
          className="pmha-input"
          placeholder={kind === "question" ? "Ask a question about this page…" : "Leave a comment on this page…"}
          value={body}
          rows={2}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          data-testid="pmhub-assistant.validation.input"
        />
        <button
          type="button"
          className="pmha-sendbtn pmha-grad"
          disabled={busy || !body.trim()}
          onClick={() => void send()}
          data-testid="pmhub-assistant.validation.send">
          <IconSend size={15} />
        </button>
      </div>
      {err && <div className="pmha-hint">{err}</div>}
    </div>
  );
}

function TriageProposalCard({
  projectId,
  scenarioId,
  proposal,
  scrollToBottom,
}: {
  projectId: string;
  scenarioId: string;
  proposal: TriageProposal;
  scrollToBottom: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "applying" | { keys: string[] } | { error: string }>("idle");

  async function apply() {
    setStatus("applying");
    const res = await pmhubPost<{ ok: boolean; created_subtask_keys: string[] }>("triage/apply", {
      projectId,
      scenarioId,
    });
    if (res.ok && res.data?.created_subtask_keys) {
      setStatus({ keys: res.data.created_subtask_keys });
    } else {
      setStatus({ error: res.ok ? "Apply returned no keys." : res.error });
    }
    scrollToBottom();
  }

  const n = proposal.subtasks.length;
  return (
    <div className="pmha-pcard">
      <div className="pmha-lbl">
        <IconFlag size={11} /> Fix plan · {n} sub-task{n === 1 ? "" : "s"}
      </div>
      <h4>{proposal.summary}</h4>
      <ul>
        {proposal.subtasks.map((st, i) => (
          <li key={i}>
            <code>{st.parent_story_key}</code> — {st.title}
          </li>
        ))}
      </ul>
      {typeof status === "object" && "keys" in status ? (
        <div className="pmha-ok">
          <IconCheck size={15} /> Created {status.keys.map((k) => k).join(", ")} · project back in Build
        </div>
      ) : typeof status === "object" && "error" in status ? (
        <div className="pmha-triage-lead">Couldn’t apply: {status.error}</div>
      ) : (
        <div className="pmha-act">
          <button type="button" className="pmha-btn pmha-prim" disabled={status === "applying"} onClick={apply}>
            {status === "applying" ? "Creating…" : `Create ${n} sub-task${n === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- icons --------------------------------- */

type IconProps = { size?: number };

function IconValidation({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7.3 8.9l1.4 1.4 2.4-2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 9h2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.3 15l1.4 1.4 2.4-2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 15.1h2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconTest({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5h6M9 5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M9.5 13l2 2 3.5-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAsk({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.4 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.4 2-2.4 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

function IconFeedback({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBug({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8.5" y="8" width="7" height="11" rx="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M9.5 5l1.3 2.2M14.5 5l-1.3 2.2M4.5 11.5h4M15.5 11.5h4M4.5 16h4M15.5 16h4M12 8.5v10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFlag({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 21V4M5 4h11l-2 3.5L16 11H5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4 4L19 6.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSend({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12l14-7-7 14-2-5-5-2z" fill="currentColor" />
    </svg>
  );
}

function IconPlus({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronDown({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCrosshair({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconChevronLeft({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCopy({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 15V6a2 2 0 0 1 2-2h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconExternal({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14 4h6v6M20 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBringBack({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 10h-6V4M14 10l7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* --------------------------------- styles --------------------------------- */

function WidgetStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

      .pmha-root{
        --ui:'Geist'; --mono:'JetBrains Mono';
        --bg:#f6f7f9; --card:#ffffff; --emph:#0f1013; --def:#3a3d44; --sub:#6f747e;
        --hair:#e6e8ec; --wash:#eef0f3; --subtle:#f2f3f5;
        --accent:#5b8def; --accentbg:rgba(91,141,239,.10);
        --green:#16a34a; --red:#dc2626;
        --shadow:0 20px 50px -18px rgba(15,20,40,.28), 0 2px 8px -2px rgba(15,20,40,.10);
        --z:2147483000;
        font-family:var(--ui),ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
      }
      .dark .pmha-root{
        --bg:#0b0c10; --card:#16171c; --emph:#f4f5f7; --def:#c6c9d1; --sub:#878b95;
        --hair:#262830; --wash:#1c1e24; --subtle:#1f2127;
        --accent:#7aa2f7; --accentbg:rgba(91,141,239,.18);
        --green:#34d399; --red:#f87171;
        --shadow:0 24px 60px -18px rgba(0,0,0,.62), 0 2px 8px -2px rgba(0,0,0,.4);
      }
      .pmha-root *{box-sizing:border-box}
      .pmha-root svg{display:block}
      .pmha-grad{background-image:linear-gradient(135deg,#8b5cf6 0%,#5b8def 38%,#22d3ee 72%,#2dd4bf 100%)}

      .pmha-bubble{position:fixed;bottom:22px;right:22px;z-index:var(--z);width:54px;height:54px;border-radius:999px;
        display:grid;place-items:center;border:none;cursor:pointer;color:#fff;
        box-shadow:0 8px 22px -6px rgba(91,141,239,.55), inset 0 1px 0 rgba(255,255,255,.35);transition:transform .18s ease}
      .pmha-bubble:hover{transform:translateY(-1px) scale(1.04)}
      .pmha-bubble:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
      .pmha-bubble::after{content:"";position:absolute;inset:0;border-radius:999px;z-index:-1;
        box-shadow:0 0 0 0 rgba(91,141,239,.45);animation:pmha-ring 2.8s ease-out infinite}
      @keyframes pmha-ring{0%{box-shadow:0 0 0 0 rgba(91,141,239,.45)}70%,100%{box-shadow:0 0 0 14px rgba(91,141,239,0)}}
      .pmha-pac{width:24px;height:24px;border-radius:50%;background:#fff;
        clip-path:polygon(50% 50%,100% 44%,100% 0,0 0,0 100%,100% 100%,100% 56%);
        animation:pmha-chomp .45s ease-in-out infinite alternate}
      .pmha-pac-sm{width:13px;height:13px}
      @keyframes pmha-chomp{from{clip-path:polygon(50% 50%,100% 44%,100% 0,0 0,0 100%,100% 100%,100% 56%)}
        to{clip-path:polygon(50% 50%,100% 26%,100% 0,0 0,0 100%,100% 100%,100% 74%)}}

      .pmha-panel{position:fixed;bottom:22px;right:22px;z-index:var(--z);width:392px;max-width:calc(100vw - 32px);
        height:min(640px,88vh);display:flex;flex-direction:column;background:var(--card);border:1px solid var(--hair);
        border-radius:18px;overflow:hidden;box-shadow:var(--shadow);color:var(--def);
        font-size:13px;line-height:1.5}
      /* popped-out into a floating window: fill it edge-to-edge */
      .pmha-root--pip{height:100%;width:100%}
      .pmha-panel--pip{position:static;inset:auto;width:100%;max-width:none;height:100%;
        border:none;border-radius:0;box-shadow:none}
      .pmha-thread{height:3px;flex:0 0 auto}
      .pmha-head{display:flex;align-items:center;gap:11px;padding:13px 14px;border-bottom:1px solid var(--hair);
        cursor:grab;user-select:none}
      .pmha-head:active{cursor:grabbing}
      .pmha-head button{cursor:pointer}
      .pmha-panel--pip .pmha-head{cursor:default}
      /* drag-to-resize grip, bottom-right corner (in-page only) */
      .pmha-resize{position:absolute;right:3px;bottom:3px;width:16px;height:16px;z-index:1;
        cursor:nwse-resize;touch-action:none;opacity:.5;
        background:linear-gradient(135deg,transparent 0 46%,var(--sub) 46% 54%,transparent 54% 62%,var(--sub) 62% 70%,transparent 70%)}
      .pmha-resize:hover{opacity:.95}
      /* in-page chip shown while the assistant is popped out */
      .pmha-chip{position:fixed;bottom:22px;right:22px;z-index:var(--z);display:inline-flex;align-items:center;gap:9px;
        max-width:calc(100vw - 44px);border:none;cursor:pointer;color:#fff;border-radius:999px;
        padding:9px 16px 9px 11px;font:inherit;font-size:12px;font-weight:550;letter-spacing:-.01em;
        box-shadow:0 8px 22px -6px rgba(91,141,239,.55), inset 0 1px 0 rgba(255,255,255,.35);transition:transform .18s ease}
      .pmha-chip:hover{transform:translateY(-1px)}
      .pmha-orb{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;flex:0 0 auto;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
      .pmha-htxt{min-width:0;flex:1}
      .pmha-title{display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:650;color:var(--emph);
        line-height:1.2;letter-spacing:-.01em}
      .pmha-live{width:6px;height:6px;border-radius:50%;background:var(--green);
        box-shadow:0 0 0 3px color-mix(in srgb,var(--green) 18%,transparent)}
      .pmha-meta{font-size:11px;color:var(--sub);font-family:var(--mono),ui-monospace,monospace;margin-top:2px;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pmha-projsw{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;
        text-decoration:underline dotted;text-underline-offset:2px}
      .pmha-projsw:hover{color:var(--emph)}
      .pmha-icbtn{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--sub);
        border:none;background:transparent;cursor:pointer}
      .pmha-icbtn:hover{background:var(--subtle);color:var(--emph)}
      .pmha-icbtn-xs{width:22px;height:22px;font-size:15px;line-height:1}

      .pmha-chat{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:14px}

      /* two-pane slider: main chat ↔ triage chat */
      .pmha-slider{flex:1;min-height:0;overflow:hidden;display:flex}
      /* Carousel that's immune to a broad max-width:100% reset (cal.diy's
         (main-nav)/Shell segment ships one, which capped a width:200% track to
         100% → half-width panes). Nothing here exceeds 100%: the track is 100%
         wide and its two 100%-wide panes overflow it (clipped by .pmha-slider's
         overflow:hidden); translateX(-100%) reveals pane 2. max-width:none beats
         the * { max-width:100% } cap on specificity. */
      .pmha-track{display:flex;width:100%;max-width:none;height:100%;transition:transform .32s cubic-bezier(.4,0,.2,1)}
      .pmha-track-triage{transform:translateX(-100%)}
      .pmha-pane{flex:0 0 100%;width:100%;max-width:none;height:100%;display:flex;flex-direction:column;min-height:0;min-width:0}
      .pmha-tchat{display:flex;flex-direction:column;height:100%;min-height:0;width:100%}
      .pmha-tchead{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--hair);flex:0 0 auto}
      .pmha-tchtxt{min-width:0;flex:1}
      .pmha-tchtitle{font-size:12.5px;font-weight:650;color:var(--emph);line-height:1.2}
      .pmha-tchstep{font-size:10.5px;color:var(--sub);font-family:var(--mono),ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
      .pmha-tcbody{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px}
      .pmha-hello{font-size:13.5px;color:var(--def);line-height:1.6}
      .pmha-hello b{color:var(--emph);font-weight:600}
      .pmha-suglabel{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--sub);margin:8px 0 0}
      .pmha-sug{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:1px solid var(--hair);
        background:var(--card);border-radius:13px;padding:11px 12px;cursor:pointer;transition:border-color .15s,background .15s;color:var(--def)}
      .pmha-sug:hover{border-color:var(--accent);background:var(--accentbg)}
      .pmha-tile{width:30px;height:30px;border-radius:9px;background:var(--subtle);display:grid;place-items:center;color:var(--accent);flex:0 0 auto}
      .pmha-sug:hover .pmha-tile{background:var(--card)}
      .pmha-t{font-size:12.5px;color:var(--emph);font-weight:600;line-height:1.3}
      .pmha-t small{display:block;color:var(--sub);font-weight:450;font-size:11px;margin-top:2px;line-height:1.35}
      .pmha-hint{font-size:11.5px;color:var(--sub);text-align:center;padding:2px 8px}

      .pmha-msg{display:flex;flex-direction:column;gap:6px;max-width:100%;min-width:0}
      .pmha-msg.pmha-user{align-items:flex-end}
      .pmha-bub{max-width:88%;padding:9px 12px;border-radius:14px;font-size:12.5px;line-height:1.55;min-width:0;word-break:break-word}
      .pmha-user .pmha-bub{background:var(--accentbg);color:var(--emph);border-bottom-right-radius:5px}
      .pmha-bot .pmha-bub{background:var(--subtle);color:var(--def);border-bottom-left-radius:5px}
      .pmha-root code{font-family:var(--mono),ui-monospace,monospace;font-size:11px;
        background:color-mix(in srgb,var(--emph) 7%,transparent);padding:1px 4px;border-radius:4px}
      .pmha-askmeta{font-size:10.5px;color:var(--sub);margin-top:3px;line-height:1.4}
      .pmha-answer{max-width:92%}
      .pmha-mdp{margin:0 0 7px}
      .pmha-answer > .pmha-mdp:last-child{margin-bottom:0}
      .pmha-mdul{margin:3px 0 8px;padding-left:17px;display:flex;flex-direction:column;gap:4px}
      .pmha-answer > .pmha-mdul:last-child{margin-bottom:0}
      .pmha-mdul li{line-height:1.5}
      .pmha-mdsp{height:3px}
      .pmha-answer b{color:var(--emph);font-weight:650}
      .pmha-intent{display:inline-flex;align-items:center;gap:7px;font-size:10.5px;font-weight:600;color:var(--sub)}
      .pmha-pill{display:inline-flex;align-items:center;gap:5px;background:var(--subtle);border:1px solid var(--hair);
        border-radius:999px;padding:2px 9px 2px 7px;color:var(--emph)}
      .pmha-link{color:var(--accent);cursor:pointer;text-decoration:none;font-weight:600;border:none;background:none;padding:0;font:inherit}
      .pmha-elchip{display:inline-flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--hair);
        border-radius:8px;padding:3px 8px;font-family:var(--mono),ui-monospace,monospace;font-size:10.5px;color:var(--emph);max-width:100%;overflow:hidden}
      .pmha-sw{width:11px;height:11px;border-radius:3px;border:1px solid var(--hair);flex:0 0 auto}

      .pmha-run{border:1px solid var(--hair);border-radius:13px;background:var(--card);overflow:hidden;width:100%}
      .pmha-run-head{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border-bottom:1px solid var(--hair)}
      .pmha-rt{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:650;color:var(--emph)}
      .pmha-rt svg{color:var(--accent)}
      .pmha-prog{font-size:11px;color:var(--sub);font-family:var(--mono),ui-monospace,monospace}
      .pmha-step{display:flex;align-items:flex-start;gap:10px;padding:10px 13px;border-bottom:1px solid var(--hair)}
      .pmha-pass{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--hair);background:transparent;
        display:grid;place-items:center;cursor:pointer;flex:0 0 auto;margin-top:1px;color:transparent}
      .pmha-pass:hover{border-color:var(--green)}
      .pmha-step.pmha-passed .pmha-pass{background:var(--green);border-color:var(--green);color:#fff}
      .pmha-step.pmha-failed .pmha-pass{border-color:var(--red)}
      .pmha-step-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
      .pmha-step-txt{font-size:12.5px;color:var(--def);line-height:1.45;min-width:0}
      .pmha-stepvals{display:flex;flex-wrap:wrap;gap:5px}
      .pmha-copychip{display:inline-flex;align-items:center;gap:5px;max-width:100%;border:1px solid var(--hair);background:var(--subtle);color:var(--emph);border-radius:7px;padding:3px 7px;cursor:pointer;font-family:var(--mono),ui-monospace,monospace;font-size:10.5px;line-height:1.2}
      .pmha-copychip:hover{border-color:var(--accent);color:var(--accent)}
      .pmha-copychip svg{flex:0 0 auto;color:var(--sub)}
      .pmha-copychip:hover svg{color:var(--accent)}
      .pmha-copyval{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px}
      .pmha-step.pmha-passed .pmha-step-txt{color:var(--sub);text-decoration:line-through;
        text-decoration-color:color-mix(in srgb,var(--sub) 50%,transparent)}
      .pmha-step-n{font-family:var(--mono),ui-monospace,monospace;font-size:10.5px;color:var(--sub);margin-right:6px}
      .pmha-flag{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--sub);
        border:1px solid var(--hair);background:var(--card);border-radius:8px;padding:4px 8px;cursor:pointer;flex:0 0 auto}
      .pmha-flag:hover:not(:disabled){color:var(--red);border-color:var(--red)}
      .pmha-flag:disabled{opacity:.4;cursor:default}
      .pmha-triage{padding:0 13px 12px 43px;border-bottom:1px solid var(--hair)}
      .pmha-triage-ta{width:100%;border:1px solid var(--hair);background:var(--subtle);border-radius:10px;padding:8px 10px;
        font:inherit;font-size:12px;color:var(--emph);resize:none;outline:none;min-height:54px}
      .pmha-triage-ta:focus{border-color:var(--accent)}
      .pmha-triage-lead{font-size:12px;color:var(--def);line-height:1.5;margin-bottom:6px}
      .pmha-tthread{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
      .pmha-tmsg{max-width:92%;padding:7px 10px;border-radius:11px;font-size:11.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
      .pmha-tbot{background:var(--subtle);color:var(--def);align-self:flex-start;border-bottom-left-radius:4px}
      .pmha-tuser{background:var(--accentbg);color:var(--emph);align-self:flex-end;border-bottom-right-radius:4px}
      .pmha-run-done{display:flex;align-items:center;gap:8px;padding:11px 13px;font-size:12px;font-weight:600;color:var(--green)}
      .pmha-run-done svg{flex:0 0 auto}

      .pmha-pcard{margin-top:9px;border:1px solid var(--hair);border-radius:11px;background:var(--card);padding:11px}
      .pmha-lbl{display:flex;align-items:center;gap:6px;font-size:9.5px;font-weight:700;letter-spacing:.06em;
        text-transform:uppercase;color:var(--sub);margin-bottom:7px}
      .pmha-lbl svg{color:var(--accent);flex:0 0 auto}
      .pmha-pcard h4{margin:0 0 6px;font-size:12.5px;color:var(--emph);font-weight:650;line-height:1.35}
      .pmha-pcard ul{margin:0;padding-left:16px;color:var(--def);font-size:11.5px;line-height:1.6}
      .pmha-act{margin-top:10px;display:flex;gap:8px}
      .pmha-btn{font-size:11.5px;font-weight:600;border-radius:9px;padding:7px 12px;cursor:pointer;
        border:1px solid var(--hair);background:var(--card);color:var(--emph)}
      .pmha-btn:disabled{opacity:.5;cursor:default}
      .pmha-btn.pmha-prim{border:none;color:#fff;background-color:transparent;
        background-image:linear-gradient(135deg,#8b5cf6 0%,#5b8def 38%,#22d3ee 72%,#2dd4bf 100%);
        box-shadow:0 2px 8px -2px rgba(91,141,239,.5)}
      .pmha-ok{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--green);font-weight:600;margin-top:9px;flex-wrap:wrap}
      .pmha-ok svg{flex:0 0 auto}

      .pmha-typing{display:inline-flex;gap:4px;align-items:center;padding:10px 13px;background:var(--subtle);
        border-radius:14px;border-bottom-left-radius:5px;width:fit-content}
      .pmha-typing span{width:6px;height:6px;border-radius:50%;background:var(--sub);animation:pmha-blink 1.2s infinite}
      .pmha-typing span:nth-child(2){animation-delay:.2s}
      .pmha-typing span:nth-child(3){animation-delay:.4s}
      @keyframes pmha-blink{0%,60%,100%{opacity:.25}30%{opacity:1}}

      .pmha-composer{border-top:1px solid var(--hair);padding:10px 12px 12px;background:var(--card)}
      .pmha-attached{display:flex;align-items:center;gap:8px;margin-bottom:8px}
      .pmha-inputrow{display:flex;align-items:flex-end;gap:8px;background:var(--subtle);border:1px solid var(--hair);
        border-radius:13px;padding:6px 6px 6px 12px}
      .pmha-input{flex:1;border:none;background:transparent;resize:none;outline:none;color:var(--emph);font:inherit;
        font-size:12.5px;line-height:1.5;max-height:90px;padding:5px 0}
      .pmha-input::placeholder{color:var(--sub)}
      .pmha-sendbtn{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;border:none;color:#fff;
        cursor:pointer;flex:0 0 auto}
      .pmha-sendbtn:disabled{opacity:.4;cursor:default}
      .pmha-ctools{display:flex;align-items:center;gap:8px;margin-top:8px}
      .pmha-pe{display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--sub);border:1px solid var(--hair);
        background:var(--card);border-radius:8px;padding:5px 10px;cursor:pointer}
      .pmha-pe:hover{color:var(--emph);border-color:var(--accent)}
      .pmha-pe:disabled{opacity:.45;cursor:default}
      .pmha-pe:disabled:hover{color:var(--sub);border-color:var(--hair)}

      .pmha-vcomposer{margin-top:10px}
      .pmha-vkinds{display:flex;gap:6px;margin-bottom:6px}
      .pmha-vcomment{font-size:12px;color:var(--emph);border:1px solid var(--hair);background:var(--card);
        border-radius:9px;padding:7px 10px;margin-top:6px;line-height:1.45}

      @media (prefers-reduced-motion: reduce){
        .pmha-pac{animation:none;clip-path:polygon(50% 50%,100% 33%,100% 0,0 0,0 100%,100% 100%,100% 67%)}
        .pmha-bubble::after{animation:none}
        .pmha-typing span{animation:none;opacity:.6}
      }
    `}</style>
  );
}
