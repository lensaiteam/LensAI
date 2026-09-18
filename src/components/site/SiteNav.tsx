"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";

/** The site's pages, in the order their page-heads are indexed (01 / Agents …). */
export const NAV_PAGES = [
  { index: "01", label: "Agents", href: "/agents" },
  { index: "02", label: "Whitepaper", href: "/whitepaper" },
  { index: "03", label: "Roadmap", href: "/roadmap" },
  { index: "04", label: "Tokenomics", href: "/tokenomics" },
];

const EASE = [0.16, 1, 0.3, 1] as const;
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The masthead. A full-width, edge-aligned bar — brand left, an indexed page list,
 * the desk's clock and the one call to action right — ruled off by a hairline once
 * the page scrolls. It steps out of the way while you read down and returns the
 * moment you scroll up; a 1px red line along its base is the read position.
 * Under 900px the page list becomes a full-screen index.
 */
export function SiteNav() {
  const pathname = usePathname();
  const { scrollY, scrollYProgress } = useScroll();
  const [stuck, setStuck] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const last = useRef(0);

  useMotionValueEvent(scrollY, "change", (v) => {
    const delta = v - last.current;
    last.current = v;
    setStuck(v > 24);
    if (Math.abs(delta) < 4) return; // ignore sub-pixel jitter from smooth scrolling
    setHidden(delta > 0 && v > 320);
  });

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // The index sheet: close on navigation and Escape; hold the page still while it is open.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header className={`mast${stuck ? " stuck" : ""}${hidden && !open ? " away" : ""}${open ? " open" : ""}`}>
        <div className="mast-in">
          <Link className="brand" href="/" aria-label="LensAI home"><span className="glyph" />LensAI</Link>
          <span className="mast-tag mono" aria-hidden="true">Research desk</span>

          <nav className="mast-links" aria-label="Primary">
            {NAV_PAGES.map((n) => (
              <Link key={n.href} className="mast-link" href={n.href} aria-current={isCurrent(n.href) ? "page" : undefined}>
                <i className="mono">{n.index}</i>
                <span>{n.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mast-right">
            <span className="mast-clock mono" title="The desk runs on one clock: UTC"><i aria-hidden="true" />{clock}<em>UTC</em></span>
            <Link className="mast-cta" href="/app"><span>Open the desk</span><span className="a" aria-hidden="true">→</span></Link>
            <button type="button" className="mast-menu mono" aria-expanded={open} aria-controls="site-index" onClick={() => setOpen((o) => !o)}>
              <span className="mast-menu-bars" aria-hidden="true"><i /><i /></span>
              {open ? "Close" : "Index"}
            </button>
          </div>
        </div>
        <motion.i className="mast-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="site-index"
            className="sheet"
            data-lenis-prevent
            role="dialog"
            aria-modal="true"
            aria-label="Site index"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <nav className="sheet-links" aria-label="Site index">
              {[...NAV_PAGES, { index: "05", label: "Careers", href: "/careers" }].map((n, i) => (
                <motion.div key={n.href} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE, delay: 0.05 + i * 0.045 }}>
                  <Link className="sheet-link" href={n.href} aria-current={isCurrent(n.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                    <i className="mono">{n.index}</i>
                    <span className="display">{n.label}</span>
                    <b aria-hidden="true">→</b>
                  </Link>
                </motion.div>
              ))}
            </nav>
            <div className="sheet-foot">
              <Link className="mast-cta" href="/app" onClick={() => setOpen(false)}><span>Open the desk</span><span className="a" aria-hidden="true">→</span></Link>
              <span className="mast-clock mono"><i aria-hidden="true" />{clock}<em>UTC</em></span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
