import Link from "next/link";

const COLS: { title: string; links: { label: string; href: string; ext?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Agents", href: "/agents" },
      { label: "Whitepaper", href: "/whitepaper" },
      { label: "Roadmap", href: "/roadmap" },
      { label: "Tokenomics", href: "/tokenomics" },
      { label: "Open the desk", href: "/app" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Use", href: "/terms-of-use" },
      { label: "Terms & Conditions", href: "/terms-conditions" },
    ],
  },
  {
    title: "Social",
    links: [
      { label: "X (Twitter)", href: "https://x.com/lensai", ext: true },
      { label: "Telegram", href: "https://t.me/lensai", ext: true },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="foot-inner lp-wrap">
        <div className="foot-brand">
          <Link className="brand" href="/"><span className="glyph" />LensAI</Link>
          <p>Decision-grade crypto analysis from live data and current news. Information and analysis, not financial advice — do your own research.</p>
        </div>
        <div className="foot-cols">
          {COLS.map((col) => (
            <div className="foot-col" key={col.title}>
              <h4>{col.title}</h4>
              {col.links.map((l) =>
                l.ext ? (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
                ) : (
                  <Link key={l.label} href={l.href}>{l.label}</Link>
                )
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="foot-base lp-wrap">
        <span>© 2026 LensAI</span>
        <span>Crypto is highly volatile. You can lose money. Not financial advice.</span>
      </div>
    </footer>
  );
}
