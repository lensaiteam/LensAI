"use client";
import Link from "next/link";

export const NAV_PAGES = [
  { label: "Whitepaper", href: "/whitepaper" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Tokenomics", href: "/tokenomics" },
];

export function SiteNav({ light, stuck, onToggle }: { light: boolean; stuck: boolean; onToggle: () => void }) {
  return (
    <nav className={`lp-nav${stuck ? " stuck" : ""}`}>
      <div className="nav-pill">
        <Link className="brand" href="/"><span className="glyph" />LensAI</Link>
        <span className="nav-div" />
        {NAV_PAGES.map((n) => (
          <Link key={n.href} className="navlink" href={n.href}>{n.label}</Link>
        ))}
        <span className="nav-div" />
        <button className="tgl" onClick={onToggle}>{light ? "Dark" : "Light"}</button>
        <Link className="tlink navcta" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
      </div>
    </nav>
  );
}
