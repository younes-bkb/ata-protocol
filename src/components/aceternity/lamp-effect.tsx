"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./effects.module.css";

type LampEffectProps = {
  className?: string;
  children?: ReactNode;
};

export function LampEffect({ className, children }: LampEffectProps) {
  return (
    <div className={cn(styles.lampRoot, className)}>
      <span className={styles.lampBeam} />
      <span className={styles.lampGlow} />
      <span className={styles.lampHalo} />
      {children}
    </div>
  );
}
