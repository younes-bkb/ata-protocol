"use client";

import {
  CSSProperties,
  MouseEvent,
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/cn";
import styles from "./effects.module.css";

type LensEffectProps = {
  children: ReactNode;
  className?: string;
};

export function LensEffect({ children, className }: LensEffectProps) {
  const [coords, setCoords] = useState({ x: 50, y: 50 });

  const handleMouseMove = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    setCoords({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setCoords({ x: 50, y: 50 });
  }, []);

  const style = useMemo<CSSProperties>(
    () => ({
      "--lens-x": `${coords.x}%`,
      "--lens-y": `${coords.y}%`,
    } as any),
    [coords.x, coords.y],
  );

  return (
    <div
      className={cn(styles.lensRoot, className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
    >
      <span className={styles.lensOverlay} aria-hidden />
      <div className={styles.lensContent}>{children}</div>
    </div>
  );
}

