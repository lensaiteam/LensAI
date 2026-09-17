"use client";
import { useState } from "react";
import { useScroll, useMotionValueEvent } from "framer-motion";
import { SmoothScroll } from "@/components/motion";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";
import "@/app/landing.css";
import "@/app/site.css";

/** Shared chrome for the marketing site: smooth scroll, the bone-white theme,
 *  the floating morph nav and the footer. Pages provide only their content. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const [stuck, setStuck] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setStuck(v > 70));

  return (
    <SmoothScroll>
      <div className="lp light">
        <SiteNav stuck={stuck} />
        {children}
        <SiteFooter />
      </div>
    </SmoothScroll>
  );
}
