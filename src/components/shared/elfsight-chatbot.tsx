"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const APP_CLASS = "elfsight-app-5079f8d5-5025-47fb-a9b7-66ab07bc0b2f";
const MOBILE_QUERY = "(max-width: 767px)";
const MOBILE_BOTTOM = "calc(5.75rem + env(safe-area-inset-bottom, 0px))";
const OFFSET_ATTR = "data-rf-chat-offset";
const MIN_KEY = "roommate-finance:chat-minimized";
const MIN_CLASS = "rf-chat-min";
/** Elfsight's own launcher / window, whichever is showing; the minimize badge rides its top-right corner. */
const WIDGET_SELECTOR = ".es-launcher-floating-container, .es-window-container, [class*='Window__WindowComponent']";

function classNameOf(el: Element) {
  return el.getAttribute("class") ?? "";
}

function walk(root: ParentNode | ShadowRoot, visit: (el: Element) => void) {
  root.querySelectorAll("*").forEach((el) => {
    visit(el);
    if (el.shadowRoot) walk(el.shadowRoot, visit);
  });
}

function isLauncher(el: Element) {
  const cls = classNameOf(el);
  if (
    cls.includes("FloatingButton") ||
    cls.includes("WidgetButton") ||
    cls.includes("eapps-widget") ||
    cls.includes("es-window-container") ||
    cls.includes("Window__WindowComponent")
  ) {
    return true;
  }
  if (!(el instanceof HTMLIFrameElement)) return false;
  const hint = `${el.title} ${el.name} ${el.id} ${el.src} ${el.className}`;
  return /elfsight|eapps/i.test(hint);
}

function applyMobileOffset() {
  const mobile = window.matchMedia(MOBILE_QUERY).matches;
  walk(document.documentElement, (el) => {
    if (!isLauncher(el) || !(el instanceof HTMLElement)) return;
    if (mobile) {
      el.style.setProperty("bottom", MOBILE_BOTTOM, "important");
      el.setAttribute(OFFSET_ATTR, "");
    } else if (el.hasAttribute(OFFSET_ATTR)) {
      el.style.removeProperty("bottom");
      el.removeAttribute(OFFSET_ATTR);
    }
  });
}

function readMinimized(): boolean {
  try {
    return window.localStorage.getItem(MIN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMinimized(min: boolean) {
  try {
    window.localStorage.setItem(MIN_KEY, min ? "1" : "0");
  } catch {
    // Storage blocked: the choice just won't be remembered.
  }
}

/** Top-right corner of the visible chat widget, or null while it hasn't rendered. */
function widgetCorner(): { x: number; y: number } | null {
  let best: DOMRect | null = null;
  walk(document.documentElement, (el) => {
    if (!el.matches(WIDGET_SELECTOR)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    if (!best || r.top < best.top) best = r;
  });
  const r = best as DOMRect | null;
  return r ? { x: Math.round(r.right), y: Math.round(r.top) } : null;
}

/** A little coin face in a cap, with a speech bubble: the chat assistant when it's tucked away. */
function ChatBuddy() {
  return (
    <svg viewBox="0 0 64 64" className="size-full overflow-visible text-foreground" aria-hidden>
      <path d="M12 30c1-11 9-18 20-18s19 7 20 18c-6-3-13-5-20-5s-14 2-20 5z" fill="var(--pop-blue)" stroke="currentColor" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M12 30c-5 0-8-1-10-4 4-2 7-2.500 11-2" fill="var(--pop-blue)" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="12" r="2.600" fill="var(--pop-pink)" stroke="currentColor" strokeWidth={1.800} />
      <ellipse cx="24" cy="39" rx="2.800" ry="3.800" fill="currentColor" />
      <ellipse cx="40" cy="39" rx="2.800" ry="3.800" fill="currentColor" />
      <circle cx="25" cy="37.500" r="1" fill="white" />
      <circle cx="41" cy="37.500" r="1" fill="white" />
      <path d="M23 47c5 5 13 5 18 0" fill="white" stroke="currentColor" strokeWidth={2.200} strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="17" cy="45" rx="3.400" ry="2.200" fill="var(--pop-pink)" opacity={0.7} />
      <ellipse cx="47" cy="45" rx="3.400" ry="2.200" fill="var(--pop-pink)" opacity={0.7} />
    </svg>
  );
}

/**
 * Elfsight AI Chatbot, mounted once from the root layout so the same launcher
 * shows on login, dashboard, and every other route without reloading the script.
 *
 * It can be tucked away into a small cartoon bubble. Minimizing only hides the widget (a class on
 * <html>), so an open conversation is still there when you bring it back. The choice is remembered.
 */
export function ElfsightChatbot() {
  const [minimized, setMinimized] = useState<boolean | null>(null);
  const [corner, setCorner] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // localStorage only exists in the browser, so the saved choice is read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinimized(readMinimized());
  }, []);

  useEffect(() => {
    if (minimized === null) return;
    document.documentElement.classList.toggle(MIN_CLASS, minimized);
    return () => document.documentElement.classList.remove(MIN_CLASS);
  }, [minimized]);

  // Keep the minimize badge on the widget's corner as it loads, opens and resizes.
  useEffect(() => {
    if (minimized !== false) return;
    const update = () =>
      setCorner((prev) => {
        const next = widgetCorner();
        return prev?.x === next?.x && prev?.y === next?.y ? prev : next;
      });
    update();
    const id = window.setInterval(update, 350);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [minimized]);

  const setAndRemember = useCallback((min: boolean) => {
    setMinimized(min);
    writeMinimized(min);
  }, []);

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(applyMobileOffset, 80);
    };
    applyMobileOffset();
    const mq = window.matchMedia(MOBILE_QUERY);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    mq.addEventListener("change", applyMobileOffset);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      mq.removeEventListener("change", applyMobileOffset);
    };
  }, []);

  return (
    <>
      <Script src="https://elfsightcdn.com/platform.js" strategy="afterInteractive" onLoad={applyMobileOffset} />
      <div className={APP_CLASS} data-elfsight-app-lazy />

      {minimized === true ? (
        <button
          type="button"
          onClick={() => setAndRemember(false)}
          aria-label="Open chat assistant"
          aria-expanded={false}
          title="Ask the assistant"
          className="group/chat fixed right-5 bottom-5 z-[2147483647] max-md:right-3 max-md:bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]"
        >
          <span className="relative block size-16 animate-bob">
            <span className="block size-full rounded-full bg-pop-yellow p-1.5 transition-[translate,box-shadow] sticker group-hover/chat:-translate-y-0.5 group-hover/chat:shadow-[5px_6px_0_0_var(--foreground)] group-active/chat:translate-x-[2px] group-active/chat:translate-y-[2px] group-active/chat:shadow-none">
              <span className="block size-full transition-transform duration-300 group-hover/chat:-rotate-6 group-hover/chat:scale-110">
                <ChatBuddy />
              </span>
            </span>
            {/* Speech bubble poking out of the corner. */}
            <span
              aria-hidden
              className="absolute -top-2.5 -right-2 grid h-6 w-8 place-items-center rounded-full bg-card sticker-sm animate-wiggle [--wiggle-amount:10deg] [--wiggle-duration:2.400s]"
            >
              <span className="flex gap-[3px]">
                <i className="size-1 rounded-full bg-foreground" />
                <i className="size-1 rounded-full bg-foreground" />
                <i className="size-1 rounded-full bg-foreground" />
              </span>
            </span>
          </span>
        </button>
      ) : null}

      {minimized === false && corner ? (
        <button
          type="button"
          onClick={() => setAndRemember(true)}
          aria-label="Minimize chat assistant"
          aria-expanded
          title="Minimize"
          style={{ left: corner.x - 24, top: corner.y - 20 }}
          className={cn(
            "fixed z-[2147483647] grid size-7 place-items-center rounded-full bg-pop-yellow text-foreground sticker-sm",
            "transition-[scale,box-shadow] hover:scale-110 hover:shadow-[3px_3px_0_0_var(--foreground)] active:scale-95",
          )}
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <path d="M3.5 8.5h9" stroke="currentColor" strokeWidth={2.400} strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </>
  );
}
