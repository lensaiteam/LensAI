"use client";
import { motion } from "framer-motion";
import { EASE, LineReveal, Sec } from "./kit";
import { GROUPS, TEAM } from "@/lib/site/team";

const rise = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "0px 0px -10% 0px" } } as const;

const initials = (name: string): string => name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();

/** 06 / The people: the founder's placard beside a register of the team, on one rule. */
export function Team() {
  if (!TEAM.length && !GROUPS.length) return null;
  const headcount = TEAM.length + GROUPS.reduce((n, g) => n + g.count, 0);
  return (
    <Sec n="06" label="The people" id="team">
      <LineReveal as="h2" className="display" lines={["A small desk,", <span key="d" className="dim">run by people who wanted it themselves.</span>]} />
      <div className="team">
        {TEAM.map((p, i) => (
          <motion.article key={p.code} className="founder" {...rise} transition={{ duration: 0.8, ease: EASE, delay: 0.08 * i }}>
            <div className="founder-top mono">
              <span>{p.code}</span>
              <span>{p.role}</span>
            </div>
            <div className="founder-body">
              {p.photo ? (
                <img className="founder-photo" src={p.photo} alt={p.name} width={160} height={160} loading="lazy" />
              ) : (
                <span className="founder-photo founder-mono" aria-hidden="true">{initials(p.name)}</span>
              )}
              <div>
                <h3 className="founder-name">{p.name}</h3>
                <p className="founder-bio">{p.bio}</p>
                <div className="founder-links">
                  {p.links.map((l) => (
                    <a key={l.href} className="tlink" href={l.href} target="_blank" rel="noreferrer">
                      <span>{l.label}</span><span className="a">→</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.article>
        ))}

        <motion.div className="crew" {...rise} transition={{ duration: 0.8, ease: EASE, delay: 0.16 }}>
          <div className="founder-top mono">
            <span>The team</span>
            <span>{headcount} people</span>
          </div>
          <ul className="crew-list">
            {GROUPS.map((g) => (
              <li key={g.code}>
                <span className="mono crew-n">{g.code}</span>
                <div>
                  <h3 className="crew-name">
                    {g.name} <span className="mono crew-count">{g.count}</span>
                  </h3>
                  <p className="crew-who">{g.who}</p>
                  <p className="crew-owns">{g.owns}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </Sec>
  );
}
