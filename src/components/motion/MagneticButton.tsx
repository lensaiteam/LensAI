"use client";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useCallback, type ReactNode, type PointerEvent } from "react";

/**
 * Magnetic button: the element eases toward the cursor, and a light spot tracks
 * the pointer (via --mx/--my CSS vars, styled by the caller). A brand
 * micro-interaction — not a hover-color swap.
 */
export function MagneticButton({
  children,
  className,
  onClick,
  strength = 0.35,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  strength?: number;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 });

  const move = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      e.currentTarget.style.setProperty("--mx", `${mx}px`);
      e.currentTarget.style.setProperty("--my", `${my}px`);
      x.set((mx - r.width / 2) * strength);
      y.set((my - r.height / 2) * strength);
    },
    [x, y, strength],
  );

  const reset = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.button
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled}
      onPointerMove={move}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
    >
      {children}
    </motion.button>
  );
}
