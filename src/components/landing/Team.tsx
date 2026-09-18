"use client";
import { motion } from "framer-motion";
import { EASE, LineReveal, Sec } from "./kit";
import { TEAM } from "@/lib/site/team";

const rise = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "0px 0px -10% 0px" } } as const;

const initials = (name: string): string => name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();

/** 06 / The people: two placards on one hairline, the desk's founders in their own words. */
export function Team() {
  if (!TEAM.length) return null;
  return (
    <Sec n="06" label="The people" id="team">
      <LineReveal as="h2" className="display" lines={["Built by two people", <span key="d" className="dim">who wanted the desk themselves.</span>]} />
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
      </div>
    </Sec>
  );
}
