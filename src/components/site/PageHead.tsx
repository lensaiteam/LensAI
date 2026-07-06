export function PageHead({ index, kicker, title, sub }: { index: string; kicker: string; title: string; sub?: string }) {
  return (
    <header className="page-head">
      <span className="kicker">{index} / {kicker}</span>
      <h1 className="display">{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
    </header>
  );
}

/** Data-driven legal / policy document. */
export function LegalDoc({
  index, kicker, title, updated, intro, sections,
}: {
  index: string; kicker: string; title: string; updated: string; intro: string;
  sections: { h: string; p: string[] }[];
}) {
  return (
    <div className="subpage lp-wrap">
      <PageHead index={index} kicker={kicker} title={title} />
      <p className="legal-updated mono">Last updated · {updated}</p>
      <p className="legal-intro">{intro}</p>
      <div className="legal-body">
        {sections.map((s, i) => (
          <section className="legal-sec" key={s.h}>
            <h2><span className="mono">{String(i + 1).padStart(2, "0")}</span>{s.h}</h2>
            {s.p.map((para, k) => <p key={k}>{para}</p>)}
          </section>
        ))}
      </div>
      <p className="legal-foot">This document is a plain-language template and not legal advice. Confirm the final wording with counsel before launch.</p>
    </div>
  );
}
