"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import styles from "./effects.module.css";

type GoogleGeminiEffectProps = {
  children: ReactNode;
  className?: string;
};

export function GoogleGeminiEffect({
  children,
  className,
}: GoogleGeminiEffectProps) {
  return (
    <div className={cn(styles.geminiRoot, className)}>
      <motion.span
        className={styles.geminiRing}
        aria-hidden
        animate={{ rotate: [0, -360] }}
        transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
      />
      <motion.span
        className={styles.geminiAura}
        aria-hidden
        animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.96, 1.05, 0.96] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className={styles.geminiContent}>{children}</div>
    </div>
  );
}

