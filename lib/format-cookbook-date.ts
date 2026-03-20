/** Formats an ISO date string into a short locale date (e.g. "Mar 5, 2026"). */
export function formatCookbookDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
