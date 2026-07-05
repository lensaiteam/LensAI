"use client";
import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Scroll-triggered reveal combos (not plain fades). Each variant choreographs
 * more than one property, per the brand motion language. Reduced-motion is
 * handled globally by <MotionConfig reducedMotion="user"> in providers.
 */
const EASE = [0.16, 1, 0.3, 1] as const;

const VARIANTS: Record<string, Variants> = {
  rise: { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0 } },
  // Focus-pull — the LensAI signature: content resolves from out-of-focus to sharp.
  focus: {
    hidden: { opacity: 0, filter: "blur(12px)", y: 14, scale: 1.012 },
    show: { opacity: 1, filter: "blur(0px)", y: 0, scale: 1 },
  },
  blur: {
    hidden: { opacity: 0, y: 24, scale: 1.03, filter: "blur(10px)" },
    show: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  },
  skew: { hidden: { opacity: 0, y: 30, skewY: 3 }, show: { opacity: 1, y: 0, skewY: 0 } },
  fade: { hidden: { opacity: 0 }, show: { opacity: 1 } },
};

export type RevealVariant = keyof typeof VARIANTS;

export function Reveal({
  children,
  variant = "rise",
  delay = 0,
  duration = 0.8,
  className,
  once = true,
}: {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      variants={VARIANTS[variant]}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "0px 0px -10% 0px" }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Container that staggers its <Item> children as they enter the viewport. */
export function Stagger({
  children,
  className,
  gap = 0.08,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "0px 0px -8% 0px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function Item({
  children,
  variant = "rise",
  className,
}: {
  children: ReactNode;
  variant?: RevealVariant;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={VARIANTS[variant]} transition={{ duration: 0.7, ease: EASE }}>
      {children}
    </motion.div>
  );
}
