"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_PAGES = [
  { label: "Agents", href: "/agents" },
  { label: "Whitepaper", href: "/whitepaper" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Tokenomics", href: "/tokenomics" },
];

export function SiteNav({ stuck }: { stuck: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={`lp-nav${stuck ? " stuck" : ""}`}>
      <div className="nav-pill">
        <Link className="brand" href="/"><span className="glyph" />LensAI</Link>
        <span className="nav-div" />
        {NAV_PAGES.map((n) => (
          <Link key={n.href} className="navlink" href={n.href} aria-current={pathname === n.href || pathname.startsWith(n.href + "/") ? "page" : undefined}>{n.label}</Link>
        ))}
        <span className="nav-div" />
        <Link className="tlink navcta" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
      </div>
    </nav>
  );
}
