"use client";
import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** Site-wide motion settings: honour the visitor's reduced-motion preference. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
