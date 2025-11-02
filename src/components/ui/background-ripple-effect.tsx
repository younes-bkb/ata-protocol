"use client";

import { CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type BackgroundRippleEffectProps = {
  className?: string;
  rows?: number;
  cols?: number;
  cellSize?: number;
  interactive?: boolean;
  autoPlay?: boolean;
};

type RippleState = {
  row: number;
  col: number;
  id: number;
};

export function BackgroundRippleEffect({
  className,
  rows = 8,
  cols = 24,
  cellSize = 56,
  interactive = false,
  autoPlay = true,
}: BackgroundRippleEffectProps) {
  const [activeRipple, setActiveRipple] = useState<RippleState | null>(null);

  const triggerRipple = useCallback(
    (row: number, col: number) => {
      const rippleId = Date.now();
      setActiveRipple({ row, col, id: rippleId });

      const maxDistance = Math.hypot(rows, cols);
      const totalDuration = 600 + maxDistance * 45;

      const timeout = window.setTimeout(() => {
        setActiveRipple((current) => (current?.id === rippleId ? null : current));
      }, totalDuration + 160);

      return () => window.clearTimeout(timeout);
    },
    [rows, cols],
  );

  useEffect(() => {
    if (!autoPlay) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      triggerRipple(Math.floor(rows / 2), Math.floor(cols / 2));
    });
    const intervalId = window.setInterval(() => {
      const row = Math.floor(Math.random() * rows);
      const col = Math.floor(Math.random() * cols);
      triggerRipple(row, col);
    }, 4200);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
    };
  }, [autoPlay, rows, cols, triggerRipple]);

  const pointerHandlers = useMemo(() => {
    if (!interactive) {
      return undefined;
    }

    return {
      onMouseEnter: (row: number, col: number) => triggerRipple(row, col),
      onClick: (row: number, col: number) => triggerRipple(row, col),
    };
  }, [interactive, triggerRipple]);

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
    gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "relative grid gap-5 opacity-60 transition-opacity duration-500",
          interactive && "pointer-events-auto opacity-75",
        )}
        style={gridStyle}
      >
        {Array.from({ length: rows * cols }).map((_, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;

          const distance =
            activeRipple === null
              ? 0
              : Math.hypot(row - activeRipple.row, col - activeRipple.col);

          const delay = activeRipple ? distance * 45 : 0;
          const duration = activeRipple ? 640 + distance * 38 : 640;

          const rippleActive = Boolean(activeRipple);

          return (
            <div
              key={`${row}-${col}`}
              className={cn(
                "relative h-full w-full rounded-3xl border border-slate-700/40 bg-slate-900/40 shadow-[0_0_0_1px_rgba(148,163,255,0.05)] transition duration-300",
                interactive && "cursor-pointer hover:border-slate-100/40",
                rippleActive && "animate-[cell-ripple_640ms_ease-out_forwards]",
              )}
              style={
                rippleActive
                  ? ({
                      animationDuration: `${duration}ms`,
                      animationDelay: `${delay}ms`,
                    } as CSSProperties)
                  : undefined
              }
              {...(interactive
                ? {
                    onMouseEnter: () => pointerHandlers?.onMouseEnter?.(row, col),
                    onClick: () => pointerHandlers?.onClick?.(row, col),
                  }
                : {})}
            >
              <span
                className="absolute inset-0 h-full w-full rounded-3xl bg-[radial-gradient(circle_at_center,_rgba(94,130,255,0.35),_transparent_70%)] opacity-0 transition-opacity"
                style={
                  rippleActive
                    ? ({
                        animation: `cell-glow ${duration}ms ease-out ${delay}ms forwards`,
                      } as CSSProperties)
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
