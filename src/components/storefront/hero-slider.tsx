"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "@/components/ui/icons";

const AUTOPLAY_MS = 7000;
const SWIPE_PX = 50;

/**
 * Home hero carousel: slides rendered on the server and passed in; this only moves between them.
 * Arrows, swipe, and pagination dots in a notch at the bottom. Autoplay pauses on hover, keyboard focus and hidden
 * tabs, and is off when the visitor prefers reduced motion. Off-screen slides are inert (not focusable or announced).
 */
export function HeroSlider({ slides, label, arrows = true }: { slides: { key: string; label: string; content: ReactNode }[]; label: string; /** Side arrows. Off for photo slides, where they'd sit on the card. */ arrows?: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const startX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduced) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [count, paused, reduced]);

  const arrow = "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface text-foreground shadow-lg transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      <div
        className="overflow-hidden rounded-[1.25rem]"
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > SWIPE_PX) go(index + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => (startX.current = null)}
      >
        <div className="flex transition-transform duration-700 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((s, i) => (
            <div
              key={s.key}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${s.label}`}
              aria-hidden={i !== index}
              inert={i !== index}
              className="w-full shrink-0"
            >
              {s.content}
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          {arrows && (
            <>
              <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className={cx(arrow, "left-4 hidden sm:grid")}>
                <Icon name="arrowLeft" className="size-5" />
              </button>
              <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className={cx(arrow, "right-4 hidden sm:grid")}>
                <Icon name="chevronRight" className="size-5" />
              </button>
            </>
          )}

          {/* Pagination in a notch cut into the card's bottom edge (inner corners curve into the page background). */}
          <div
            className={cx(
              "absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-t-[1.25rem] bg-surface px-6 pt-3 pb-2.5",
              "before:absolute before:bottom-0 before:-left-5 before:size-5 before:bg-[radial-gradient(circle_at_0_0,transparent_1.25rem,var(--surface)_calc(1.25rem+0.5px))]",
              "after:absolute after:-right-5 after:bottom-0 after:size-5 after:bg-[radial-gradient(circle_at_100%_0,transparent_1.25rem,var(--surface)_calc(1.25rem+0.5px))]",
            )}
          >
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}: ${s.label}`}
                aria-current={i === index ? "true" : undefined}
                className={cx(
                  "h-2.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  i === index ? "w-11 bg-brand" : "w-2.5 bg-muted/35 hover:bg-muted",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
