/**
 * The people who run the desk. Shown on the landing page (section 06). Photos live
 * in public/team/ and are shown greyscale in the site's ink-on-bone language, in
 * colour on hover. Nothing here is invented: names, roles and headcounts come from
 * the founders, and the bio says what the desk stands for, not a made-up career.
 */
export interface Person {
  /** Placard index, e.g. "F.1". */
  code: string;
  name: string;
  /** Role as it should read on the placard, e.g. "Founder & CEO". */
  role: string;
  /** Two or three sentences. */
  bio: string;
  /** Path under public/, e.g. "/team/name.jpg". Omit for a monogram. */
  photo?: string;
  links: { label: string; href: string }[];
}

export interface Group {
  code: string;
  name: string;
  /** Headcount, stated plainly. */
  count: number;
  /** Who is in it, in the founders' words. */
  who: string;
  /** What the group owns, one line. */
  owns: string;
}

export const TEAM: Person[] = [
  {
    code: "F.1",
    name: "Ryan Collins",
    role: "Founder & CEO",
    bio: "Ryan started LensAI because crypto research kept collapsing into sentiment scores and price calls. He set the desk one rule and holds the team to it: every connection is measured, mechanical, or labeled conjecture, and none of it tells you what to do.",
    photo: "/team/ryan-collins.jpg",
    links: [{ label: "LinkedIn", href: "https://www.linkedin.com/in/ryan-collins-785017355/" }],
  },
];

export const GROUPS: Group[] = [
  { code: "T.1", name: "Engineering", count: 5, who: "Three lead developers, a frontend developer, and a backend and infrastructure engineer.", owns: "The engine, the agents, the desk, and the always-on deployment." },
  { code: "T.2", name: "Design", count: 2, who: "Two designers.", owns: "The site and the desk as one printed language: sheets, hairlines, and nothing generic." },
  { code: "T.3", name: "Interns", count: 2, who: "Two interns, embedded with engineering and design.", owns: "Source curation, the mechanism graph, and the calibration record." },
];
