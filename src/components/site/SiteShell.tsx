"use client";
import { SmoothScroll } from "@/components/motion";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";
import "@/app/landing.css";
import "@/app/site.css";

/** Shared chrome for the marketing site: smooth scroll, the bone-white theme,
 *  the masthead and the footer. Pages provide only their content. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <div className="lp light">
        <SiteNav />
        {children}
        <SiteFooter />
      </div>
    </SmoothScroll>
  );
}
