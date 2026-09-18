import { Providers } from "../providers";

/** The desk is the only route that needs wallet, query and session providers,
 *  so they mount here rather than on every marketing page. */
export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
