"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/cn";
import styles from "./background-ripple-effect.module.css";

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
  cols = 27,
  cellSize = 56,
  interactive = false,
  autoPlay = true,
}: BackgroundRippleEffectProps) {
  const [activeRipple, setActiveRipple] = useState<RippleState | null>(null);

  const triggerRipple = useCallback(
    (row: number, col: number) => {
      const id = Date.now();
      setActiveRipple({ row, col, id });

      const maxDistance = Math.hypot(rows, cols);
      const totalDuration = 600 + maxDistance * 45;

      window.setTimeout(() => {
        setActiveRipple((current) => (current?.id === id ? null : current));
      }, totalDuration + 160);
    },
    [rows, cols],
  );

  useEffect(() => {
    if (!autoPlay) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      triggerRipple(Math.floor(rows / 2), Math.floor(cols / 2));
    });
    const intervalId = window.setInterval(() => {
      const row = Math.floor(Math.random() * rows);
      const col = Math.floor(Math.random() * cols);
      triggerRipple(row, col);
    }, 4200);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(intervalId);
    };
  }, [autoPlay, rows, cols, triggerRipple]);

  const handleInteraction = useCallback(
    (row: number, col: number) => {
      if (!interactive) {
        return;
      }
      triggerRipple(row, col);
    },
    [interactive, triggerRipple],
  );

  const rootStyle = useMemo(
    () =>
      ({
        "--pointer-events": interactive ? "auto" : "none",
      }) as CSSProperties,
    [interactive],
  );

  const gridStyle = useMemo(
    () =>
      ({
        "--rows": rows,
        "--cols": cols,
        "--cell-size": `${cellSize}px`,
      }) as CSSProperties,
    [rows, cols, cellSize],
  );

  return (
    <div className={cn(styles.root, className)} style={rootStyle}>
      <div className={styles.grid} style={gridStyle} aria-hidden>
        {Array.from({ length: rows * cols }).map((_, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;

          const distance =
            activeRipple === null
              ? 0
              : Math.hypot(row - activeRipple.row, col - activeRipple.col);

          const delay = activeRipple ? distance * 46 : 0;
          const duration = activeRipple ? 680 + distance * 42 : 680;

          const cellStyle: CSSProperties = activeRipple
            ? ({
                "--delay": `${delay}ms`,
                "--duration": `${duration}ms`,
              } as CSSProperties)
            : {};

          const eventHandlers: {
            onMouseEnter?: (event: MouseEvent<HTMLSpanElement>) => void;
            onClick?: (event: MouseEvent<HTMLSpanElement>) => void;
          } = {};

          if (interactive) {
            eventHandlers.onMouseEnter = () => handleInteraction(row, col);
            eventHandlers.onClick = () => handleInteraction(row, col);
          }

          return (
            <span
              key={`${row}-${col}`}
              className={cn(
                styles.cell,
                interactive && styles.cellInteractive,
                activeRipple && styles.cellRipple,
              )}
              style={cellStyle}
              {...eventHandlers}
            />
          );
        })}
      </div>
      <div className={styles.glow} />
    </div>
  );
}
