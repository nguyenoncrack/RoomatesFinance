"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SRC = "/audio/relax.mp3";
const PREF_KEY = "roommate-finance:music";
const VOLUME = 0.3;

function readPref(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

function writePref(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the toggle still works for this visit.
  }
}

/** Ramps volume with a timer (not rAF) so fades still finish in a background tab. */
function fadeTo(audio: HTMLAudioElement, target: number, ms: number, done?: () => void) {
  const steps = Math.max(1, Math.round(ms / 50));
  const start = audio.volume;
  let i = 0;
  const id = window.setInterval(() => {
    i++;
    audio.volume = Math.min(1, Math.max(0, start + ((target - start) * i) / steps));
    if (i >= steps) {
      window.clearInterval(id);
      done?.();
    }
  }, 50);
  return () => window.clearInterval(id);
}

/**
 * Looping background music with a hand-drawn record toggle. Browsers only allow sound after the
 * visitor interacts, so when music is on it fades in on the first click or key press. The choice
 * is remembered per browser.
 */
export function MusicToggle({ className }: { className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const cancelFade = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);

  const start = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.paused) return;
    cancelFade.current?.();
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        cancelFade.current = fadeTo(audio, VOLUME, 1500);
      })
      .catch(() => {
        // Still blocked (no user gesture yet); the next interaction will try again.
      });
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    cancelFade.current?.();
    cancelFade.current = fadeTo(audio, 0, 500, () => audio.pause());
  }, []);

  // When music is on, start on the first interaction anywhere on the page.
  useEffect(() => {
    if (!readPref()) return;
    const kick = () => {
      start();
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, [start]);

  useEffect(() => () => cancelFade.current?.(), []);

  function toggle() {
    if (playing) {
      writePref(false);
      stop();
    } else {
      writePref(true);
      start();
    }
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={SRC}
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? "Turn background music off" : "Turn background music on"}
        title={playing ? "Music on" : "Music off"}
        className={cn(
          "group/music relative grid size-9 shrink-0 place-items-center rounded-full bg-lilac text-foreground sticker-sm transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-[3px_4px_0_0_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
          className,
        )}
      >
        {/* Hand-drawn vinyl record; spins while playing. */}
        <svg
          viewBox="0 0 32 32"
          className={cn("size-7 overflow-visible", playing ? "animate-[spin_3.2s_linear_infinite] motion-reduce:animate-none" : "")}
          aria-hidden
        >
          <circle cx="16" cy="16" r="13" fill="currentColor" />
          <circle cx="16" cy="16" r="10" fill="none" stroke="white" strokeOpacity={0.25} strokeWidth={0.8} />
          <circle cx="16" cy="16" r="7.5" fill="none" stroke="white" strokeOpacity={0.2} strokeWidth={0.8} />
          <circle cx="16" cy="16" r="5" fill="var(--pop-pink)" stroke="white" strokeOpacity={0.4} strokeWidth={0.8} />
          <circle cx="16" cy="16" r="1.4" fill="var(--lilac)" />
          <path d="M8 10.5c1.5-2 3.4-3.2 5.6-3.7" stroke="white" strokeOpacity={0.6} strokeWidth={1.3} strokeLinecap="round" fill="none" />
        </svg>
        {/* Little notes drift up while music plays; a slash shows when it's off. */}
        {playing ? (
          <span aria-hidden className="pointer-events-none absolute -top-1 -right-1">
            <span className="absolute -top-1 right-0 block animate-[note-rise_2.4s_ease-out_infinite] font-hand text-base leading-none">♪</span>
            <span className="absolute -top-1 right-2 block animate-[note-rise_2.4s_ease-out_1.2s_infinite] font-hand text-sm leading-none opacity-0">♫</span>
          </span>
        ) : (
          <svg aria-hidden viewBox="0 0 36 36" className="pointer-events-none absolute inset-0 size-full overflow-visible">
            <path d="M8 28L28 8" stroke="var(--foreground)" strokeWidth={2.4} strokeLinecap="round" />
            <path d="M8 28L28 8" stroke="var(--pop-pink)" strokeWidth={1} strokeLinecap="round" />
          </svg>
        )}
      </button>
    </>
  );
}
