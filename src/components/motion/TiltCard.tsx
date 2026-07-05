"use client";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useCallback, type ReactNode, type PointerEvent } from "react";

/**
 * Spotlight tilt card: a subtle pointer-tracked 3D tilt plus a gold light that
 * follows the cursor (--mx/--my for the caller's radial-gradient background).
 */
export function TiltCard({
  children,
  className,
  max = 7,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 200, damping: 18 });

  const move = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      px.set(nx);
      py.set(ny);
      e.currentTarget.style.setProperty("--mx", `${nx * 100}%`);
      e.currentTarget.style.setProperty("--my", `${ny * 100}%`);
    },
    [px, py],
  );

  const reset = useCallback(() => {
    px.set(0.5);
    py.set(0.5);
  }, [px, py]);

  return (
    <motion.div
      className={className}
      onPointerMove={move}
      onPointerLeave={reset}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", transformPerspective: 900 }}
    >
      {children}
    </motion.div>
  );
}
