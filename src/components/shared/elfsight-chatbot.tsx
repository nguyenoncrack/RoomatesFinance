"use client";

import Script from "next/script";
import { useEffect } from "react";

const APP_CLASS = "elfsight-app-5079f8d5-5025-47fb-a9b7-66ab07bc0b2f";
const MOBILE_QUERY = "(max-width: 767px)";
const MOBILE_BOTTOM = "calc(5.75rem + env(safe-area-inset-bottom, 0px))";
const OFFSET_ATTR = "data-rf-chat-offset";

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

/**
 * Elfsight AI Chatbot, mounted once from the root layout so the same launcher
 * shows on login, dashboard, and every other route without reloading the script.
 */
export function ElfsightChatbot() {
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
    </>
  );
}
