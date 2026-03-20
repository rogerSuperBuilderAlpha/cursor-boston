export function matchesCookbookSearchTerms(
  title: string,
  description: string,
  tags: string[],
  terms: string[]
): boolean {
  if (terms.length === 0) return true;
  const titleL = title.toLowerCase();
  const descL = description.toLowerCase();
  const tagStr = tags.join(" ").toLowerCase();
  return terms.some(
    (term) =>
      titleL.includes(term) ||
      descL.includes(term) ||
      tagStr.includes(term)
  );
}
