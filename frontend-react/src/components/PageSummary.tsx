/**
 * Compact summary banner shown below the page title.
 * Use a single line of text; segments are typically separated by " · " for consistency.
 */
export function PageSummary({ children }: { children: React.ReactNode }) {
  return <p className="page-summary">{children}</p>;
}
