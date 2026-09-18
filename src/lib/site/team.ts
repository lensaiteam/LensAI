/**
 * The people who run the desk. Shown on the landing page (section 06) only when
 * this list is non-empty. Photos live in public/team/ and are shown greyscale in
 * the site's ink-on-bone language, in colour on hover. No entry is ever invented:
 * fill this from the founders' own words.
 */
export interface Person {
  /** Placard index, e.g. "F.1". */
  code: string;
  name: string;
  /** Role as it should read on the placard, e.g. "Founder & CEO". */
  role: string;
  /** Two or three sentences, first person or third, in the founder's own words. */
  bio: string;
  /** Path under public/, e.g. "/team/name.jpg". Omit for a monogram. */
  photo?: string;
  links: { label: string; href: string }[];
}

export const TEAM: Person[] = [];
