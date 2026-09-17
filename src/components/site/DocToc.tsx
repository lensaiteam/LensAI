"use client";
import { useEffect, useState } from "react";

/**
 * Contents rail for a long document: a sticky, numbered list that marks the section
 * you are reading. The active section is the last one whose top has crossed the
 * upper third of the viewport — stable while a section scrolls, and cheap.
 */
export function DocToc({ items }: { items: { id: string; n: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const line = window.innerHeight * 0.34;
      let current = items[0]?.id;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= line) current = it.id;
      }
      setActive(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  return (
    <nav className="toc" aria-label="Contents">
      <div className="toc-cap mono">Contents</div>
      <ol>
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`} className={it.id === active ? "on" : ""} aria-current={it.id === active ? "location" : undefined}>
              <i className="mono">{it.n}</i>
              <span>{it.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
