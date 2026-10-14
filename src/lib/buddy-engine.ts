import { arcPoint, easeInCubic, lerp, pickWeighted, randomBetween, walkSpan, type Point } from "./buddy-math";

/**
 * Behaviour for the roaming buddy. Everything here is visual: it only moves an overlay that ignores the
 * pointer, reads element positions, and never touches app data or changes the page layout.
 *
 * He stands on "ledges" taken from the real page: the top edge of each card and of text boxes. Before he
 * stands anywhere, and again while he's there, the space around him is probed with elementFromPoint; if text,
 * a button, an input, a chart or an icon is there, he moves on.
 */

export interface BuddyDom {
  buddy: HTMLElement;
  suds: HTMLElement;
}

type Kind = "card" | "input";
interface Spot {
  el: Element;
  kind: Kind;
  /** 0..1 along the walkable stretch of the ledge. */
  u: number;
}
type HopTarget = "card" | "input" | "clean";
type Step =
  | { t: "idle"; ms: number; look?: boolean }
  | { t: "sit"; ms: number }
  | { t: "walk"; u: number }
  | { t: "hop"; to: HopTarget }
  | { t: "clean"; ms: number }
  | { t: "happy"; ms: number };
type Phase = "gone" | "idle" | "walk" | "sit" | "clean" | "happy" | "hop" | "poofOut" | "poofIn";

/** Every big sticker surface: cards, plus the greeting banner, the dark ring panel and the settle reminder. */
const CARD_SELECTOR = "main [data-slot='card'], main .sticker";
const INPUT_SELECTOR = "main input:not([type]), main input[type='text'], main input[type='search'], main input[type='email'], main textarea";
const INTERACTIVE = "a,button,input,select,textarea,label,svg,img,canvas,video,iframe,audio,[role='button'],[role='tab'],[role='checkbox'],[role='switch'],[role='combobox'],[role='slider']";

/** How far he stays from the edges: clear height above his feet and half his width. */
const BODY_H = 50;
const PAD = 22;
const WALK_SPEED = 34; // px per second
const HOP_LIMIT = 420; // farther than this he pops away and reappears instead of jumping
const CHECK_MS = 250;
const PATCH_W = 56;

const POSE: Record<Phase, string> = {
  gone: "sit",
  idle: "idle",
  walk: "walk",
  sit: "sit",
  clean: "clean",
  happy: "happy",
  hop: "hop",
  poofOut: "poof",
  poofIn: "poof",
};

interface Env {
  vw: number;
  vh: number;
  mobile: boolean;
  left: number;
  minY: number;
  maxY: number;
}

function readEnv(): Env {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const aside = document.querySelector("aside");
  const left = aside && aside.getBoundingClientRect().width > 0 ? aside.getBoundingClientRect().right : 0;
  const header = document.querySelector("header");
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  return { vw, vh, mobile, left, minY: headerBottom + BODY_H + 10, maxY: vh - (mobile ? 200 : 130) };
}

/** Where he may walk along a ledge. Phones keep him in one small area, away from the tab bar and controls. */
function spanOf(rect: DOMRect, e: Env) {
  const min = e.mobile ? Math.max(e.left + 18, e.vw - 190) : e.left + 18;
  const max = e.mobile ? e.vw - 26 : e.vw - 18;
  return walkSpan(rect.left, rect.right, PAD, min, max);
}

function isBlankAt(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
  const el = document.elementFromPoint(x, y);
  if (!el) return false;
  if (el === document.documentElement || el === document.body) return true;
  if (el.closest(INTERACTIVE)) return false;
  for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) return false;
  return true;
}

/** True when nothing readable or clickable is where his body would be. */
function zoneBlank(x: number, y: number): boolean {
  const pts: [number, number][] = [
    [0, -4],
    [0, -18],
    [0, -34],
    [-12, -22],
    [12, -22],
    [0, -BODY_H + 2],
  ];
  return pts.every(([dx, dy]) => isBlankAt(x + dx, y + dy));
}

/** True when the patch he'd scrub, just inside the card's top edge, is empty card padding. */
function patchBlank(x: number, y: number): boolean {
  const pts: [number, number][] = [
    [-22, 6],
    [0, 6],
    [22, 6],
    [-22, 16],
    [0, 16],
    [22, 16],
  ];
  return pts.every(([dx, dy]) => isBlankAt(x + dx, y + dy));
}

function placeOf(spot: Spot, e: Env): (Point & { span: { start: number; end: number } }) | null {
  if (!spot.el.isConnected) return null;
  const r = spot.el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const span = spanOf(r, e);
  if (!span) return null;
  return { x: lerp(span.start, span.end, spot.u), y: r.top, span };
}

function ledgeUsable(spot: Spot, e: Env): boolean {
  const p = placeOf(spot, e);
  return !!p && p.y >= e.minY && p.y <= e.maxY && !spot.el.closest("[role='dialog']");
}

function candidates(e: Env, kind?: Kind): Spot[] {
  const out: Spot[] = [];
  const add = (selector: string, k: Kind) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el.closest("[role='dialog']")) return;
      const r = el.getBoundingClientRect();
      if (r.width < 150 || r.height < 20 || r.top < e.minY || r.top > e.maxY) return;
      if (!spanOf(r, e)) return;
      out.push({ el, kind: k, u: 0.5 });
    });
  };
  if (!kind || kind === "card") add(CARD_SELECTOR, "card");
  if ((!kind || kind === "input") && !e.mobile) add(INPUT_SELECTOR, "input");
  return out;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickSpot(e: Env, opts: { kind?: Kind; avoid?: Element | null; clean?: boolean } = {}): Spot | null {
  const list = shuffle(candidates(e, opts.kind)).filter((s) => s.el !== opts.avoid);
  for (const spot of list.slice(0, 8)) {
    for (let i = 0; i < 4; i++) {
      const u = randomBetween(0.1, 0.9);
      const p = placeOf({ ...spot, u }, e);
      if (!p || !zoneBlank(p.x, p.y)) continue;
      if (opts.clean && !patchBlank(p.x, p.y)) continue;
      return { ...spot, u };
    }
  }
  return null;
}

export interface BuddyHandle {
  stop: () => void;
}

export function startBuddy({ buddy, suds }: BuddyDom): BuddyHandle {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  buddy.style.setProperty("--blink-delay", `-${(Math.random() * 5).toFixed(2)}s`);

  let phase: Phase = "gone";
  let spot: Spot | null = null;
  let queue: Step[] = [];
  let until = 0;
  let facing: 1 | -1 = 1;
  let walkTarget = 0.5;
  let walkSpeed = WALK_SPEED;
  let hop: { from: Point; to: Spot; t0: number; dur: number; lift: number } | null = null;
  let pending: Spot | null = null;
  let lastCheck = 0;
  let nextLook = 0;
  let nextRetry = 0;
  let hidden = true;
  let raf = 0;
  let last = performance.now();
  let curPose = "";
  let curFacing = 0;
  let lastAhead = 0;
  let envCache: Env | null = null;
  let envAt = 0;

  /** Layout reads are cheap but not free; refresh the shared measurements a few times a second. */
  const env = (force = false): Env => {
    const now = performance.now();
    if (force || !envCache || now - envAt > 120) {
      envCache = readEnv();
      envAt = now;
    }
    return envCache;
  };

  const setPose = (p: Phase) => {
    phase = p;
    const pose = POSE[p];
    if (pose !== curPose) {
      curPose = pose;
      buddy.dataset.pose = pose;
    }
  };
  const setFacing = (f: 1 | -1) => {
    facing = f;
    if (f !== curFacing) {
      curFacing = f;
      buddy.dataset.facing = f === 1 ? "right" : "left";
    }
  };
  const show = (on: boolean) => {
    if (hidden === !on) return;
    hidden = !on;
    buddy.style.opacity = on ? "1" : "0";
    if (!on) suds.removeAttribute("data-on");
  };
  const dialogOpen = () => !!document.querySelector("[role='dialog']:not([data-state='closed']), [data-radix-popper-content-wrapper] [data-state='open']");

  function putSuds(on: boolean, gleam = false) {
    if (on) suds.setAttribute("data-on", "");
    else suds.removeAttribute("data-on");
    if (gleam) suds.setAttribute("data-gleam", "");
    else suds.removeAttribute("data-gleam");
  }

  /* ------------------------------ planning ------------------------------ */

  function plan() {
    const e = env();
    const choice = pickWeighted<"sit" | "walk" | "hop" | "input" | "clean">(
      [
        { w: 38, v: "sit" },
        { w: 18, v: "walk" },
        { w: 14, v: "hop" },
        { w: e.mobile ? 0 : 10, v: "input" },
        { w: 16, v: "clean" },
      ],
      Math.random(),
    );
    const look = Math.random() < 0.6;
    const r = (a: number, b: number) => Math.round(randomBetween(a, b));
    if (choice === "sit") queue = [{ t: "idle", ms: r(900, 2400), look }, { t: "sit", ms: r(7000, 15000) }];
    else if (choice === "walk") queue = [{ t: "walk", u: randomBetween(0.05, 0.95) }, { t: "idle", ms: r(1200, 3000), look: true }, { t: "sit", ms: r(4000, 9000) }];
    else if (choice === "hop") queue = [{ t: "hop", to: "card" }, { t: "idle", ms: r(1200, 2600), look: true }, { t: "sit", ms: r(5000, 11000) }];
    else if (choice === "input") queue = [{ t: "hop", to: "input" }, { t: "sit", ms: r(8000, 16000) }];
    else queue = [{ t: "hop", to: "clean" }, { t: "clean", ms: r(4500, 7500) }, { t: "happy", ms: 2000 }, { t: "idle", ms: r(2000, 4000), look: true }];
  }

  function startHopTo(to: Spot, from: Point, now: number) {
    const dest = placeOf(to, env()) ?? from;
    const dist = Math.hypot(dest.x - from.x, dest.y - from.y);
    if (dist > HOP_LIMIT) {
      pending = to;
      setPose("poofOut");
      until = now + 260;
      return;
    }
    hop = { from, to, t0: now, dur: randomBetween(520, 780) + dist * 0.35, lift: 26 + dist * 0.12 };
    setFacing(dest.x >= from.x ? 1 : -1);
    setPose("hop");
  }

  function nextStep(now: number, depth = 0): void {
    if (!spot) return;
    if (depth > 6) {
      queue = [{ t: "idle", ms: 2500, look: true }];
    }
    const s = queue.shift();
    if (!s) {
      plan();
      return nextStep(now, depth + 1);
    }
    const e = env();
    switch (s.t) {
      case "idle":
        setPose("idle");
        until = now + s.ms;
        nextLook = s.look ? now + randomBetween(400, 1200) : Infinity;
        return;
      case "sit":
        setPose("sit");
        until = now + s.ms;
        nextLook = now + randomBetween(1500, 3500);
        return;
      case "walk": {
        const p = placeOf(spot, e);
        if (!p) return nextStep(now, depth + 1);
        let target = s.u;
        if (Math.abs(target - spot.u) * (p.span.end - p.span.start) < 30) target = spot.u < 0.5 ? Math.min(0.95, spot.u + 0.35) : Math.max(0.05, spot.u - 0.35);
        walkTarget = target;
        walkSpeed = WALK_SPEED * randomBetween(0.8, 1.25);
        setFacing(target >= spot.u ? 1 : -1);
        setPose("walk");
        return;
      }
      case "hop": {
        const here = placeOf(spot, e);
        if (!here) return nextStep(now, depth + 1);
        if (s.to === "clean") {
          // Already on a spot with an empty patch? Scrub right here.
          if (patchBlank(here.x, here.y)) return nextStep(now, depth + 1);
          const to = pickSpot(e, { kind: "card", avoid: spot.el, clean: true });
          if (!to) {
            queue = [];
            return nextStep(now, depth + 1);
          }
          return startHopTo(to, here, now);
        }
        const to = pickSpot(e, { kind: s.to, avoid: spot.el });
        if (!to) return nextStep(now, depth + 1);
        return startHopTo(to, here, now);
      }
      case "clean": {
        const here = placeOf(spot, e);
        if (!here || !patchBlank(here.x, here.y)) {
          queue = [{ t: "idle", ms: 1500, look: true }];
          return nextStep(now, depth + 1);
        }
        setPose("clean");
        until = now + s.ms;
        putSuds(true);
        return;
      }
      case "happy":
        setPose("happy");
        until = now + s.ms;
        putSuds(false, true);
        return;
    }
  }

  /** Moves him to a fresh spot (appearing with a pop), or tucks him away if the page has nowhere suitable. */
  function relocate(now: number) {
    const e = env(true);
    const to = pickSpot(e);
    queue = [];
    hop = null;
    pending = null;
    putSuds(false);
    if (!to) {
      spot = null;
      setPose("gone");
      show(false);
      nextRetry = now + 1000;
      return;
    }
    spot = to;
    setFacing(Math.random() < 0.5 ? 1 : -1);
    setPose("poofIn");
    until = now + 300;
    show(true);
  }

  /* ------------------------------ per frame ------------------------------ */

  function housekeeping(now: number, e: Env) {
    if (document.hidden || dialogOpen()) {
      show(false);
      putSuds(false);
      return;
    }
    if (!spot) {
      if (now >= nextRetry) relocate(now);
      return;
    }
    const p = ledgeUsable(spot, e) ? placeOf(spot, e) : null;
    if (!p || (phase !== "hop" && phase !== "poofOut" && !zoneBlank(p.x, p.y))) {
      relocate(now);
      return;
    }
    if (hidden) show(true);
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (document.hidden) return;
    const e = env();

    if (now - lastCheck >= CHECK_MS) {
      lastCheck = now;
      housekeeping(now, env(true));
    }
    if (!spot || hidden) return;

    switch (phase) {
      case "poofIn":
        if (now >= until) nextStep(now);
        break;
      case "poofOut":
        if (now >= until && pending) {
          spot = pending;
          pending = null;
          setPose("poofIn");
          until = now + 300;
        }
        break;
      case "idle":
      case "sit":
        if (now >= until) nextStep(now);
        else if (now >= nextLook) {
          buddy.style.setProperty("--look", String([-2.2, 0, 2.2, -1, 1][Math.floor(Math.random() * 5)]));
          nextLook = now + randomBetween(1300, 3600);
        }
        break;
      case "walk": {
        const p = placeOf(spot, e);
        if (!p) break;
        const len = p.span.end - p.span.start;
        spot.u += ((walkTarget >= spot.u ? 1 : -1) * walkSpeed * dt) / len;
        if ((facing === 1 && spot.u >= walkTarget) || (facing === -1 && spot.u <= walkTarget)) {
          spot.u = walkTarget;
          nextStep(now);
        } else if (now - lastAhead > 180 && ((lastAhead = now), !zoneBlank(p.x + facing * 14, p.y))) {
          // Something readable ahead: stop and look around instead of walking over it.
          setPose("idle");
          until = now + 1200;
          nextLook = now + 300;
          queue = [{ t: "idle", ms: 600, look: true }];
        }
        break;
      }
      case "hop": {
        if (!hop) break;
        const p = (now - hop.t0) / hop.dur;
        if (p >= 1) {
          spot = hop.to;
          hop = null;
          // A short beat on landing before the next thing.
          setPose("idle");
          until = now + 350;
        }
        break;
      }
      case "clean":
      case "happy":
        if (now >= until) {
          putSuds(false);
          nextStep(now);
        }
        break;
      default:
        break;
    }

    render(now, e);
  }

  function render(now: number, e: Env) {
    if (!spot) return;
    let x: number;
    let y: number;
    if (phase === "hop" && hop) {
      const to = placeOf(hop.to, e);
      if (!to) {
        relocate(now);
        return;
      }
      const pt = arcPoint(hop.from, to, (now - hop.t0) / hop.dur, hop.lift);
      x = pt.x;
      y = pt.y;
    } else {
      const p = placeOf(spot, e);
      if (!p) return;
      x = p.x;
      y = p.y;
    }
    if (y < e.minY - 8 || y > e.maxY + 40) {
      show(false);
      putSuds(false);
      return;
    }
    if (hidden && !document.hidden && !dialogOpen()) show(true);
    const poofScale = phase === "poofOut" ? 1 - easeInCubic(Math.min(1, 1 - (until - now) / 260)) * 0.8 : phase === "poofIn" ? 0.2 + 0.8 * Math.min(1, 1 - (until - now) / 300) : 1;
    buddy.style.transform = `translate3d(${(x - 22).toFixed(1)}px, ${(y - 58).toFixed(1)}px, 0) scale(${(0.85 * poofScale).toFixed(3)})`;
    if (phase === "clean" || phase === "happy") {
      suds.style.transform = `translate3d(${(x - PATCH_W / 2).toFixed(1)}px, ${(y + 4).toFixed(1)}px, 0)`;
    }
  }

  /* -------------------------- reduced motion --------------------------- */

  /** Sitting still on one card; only repositioned when the page scrolls or resizes. */
  function startStatic(): BuddyHandle {
    setPose("sit");
    let ticking = false;
    const reposition = () => {
      ticking = false;
      const e = env(true);
      if (document.hidden || dialogOpen()) return show(false);
      let p = spot && ledgeUsable(spot, e) ? placeOf(spot, e) : null;
      if (!spot || !p || !zoneBlank(p.x, p.y)) {
        spot = pickSpot(e);
        p = spot ? placeOf(spot, e) : null;
      }
      if (!spot || !p) return show(false);
      show(true);
      buddy.style.transform = `translate3d(${(p.x - 22).toFixed(1)}px, ${(p.y - 58).toFixed(1)}px, 0) scale(0.85)`;
    };
    const schedule = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(reposition);
      }
    };
    const timer = window.setInterval(schedule, 1000);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return {
      stop: () => {
        window.clearInterval(timer);
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
      },
    };
  }

  if (reduced) return startStatic();

  const kick = () => {
    lastCheck = 0;
  };
  // Re-check right away whenever the page moves, so content scrolling in under him is noticed within a frame.
  window.addEventListener("resize", kick);
  window.addEventListener("scroll", kick, { passive: true });
  document.addEventListener("visibilitychange", kick);
  raf = requestAnimationFrame(frame);
  return {
    stop: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", kick);
      window.removeEventListener("scroll", kick);
      document.removeEventListener("visibilitychange", kick);
    },
  };
}
