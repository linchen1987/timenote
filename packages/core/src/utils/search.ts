export function filterNotes<T extends { content: string; id: string }>(
  notes: T[],
  searchQuery: string,
  noteTagsMap?: Record<string, string[]>,
): T[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return notes;

  const searchTerms = query.split(/\s+/).filter((term) => term.length > 0);
  const textTerms = searchTerms.filter((term) => !term.startsWith('#'));
  const tagTerms = searchTerms.filter((term) => term.startsWith('#')).map((t) => t.slice(1));

  return notes.filter((note) => {
    const content = note.content.toLowerCase();

    const matchesText = textTerms.every((term) => content.includes(term));
    if (!matchesText) return false;

    if (tagTerms.length > 0) {
      const noteTags = noteTagsMap?.[note.id] || [];
      const noteTagsLower = noteTags.map((t) => t.toLowerCase());
      const matchesTags = tagTerms.every((tag) => noteTagsLower.includes(tag));
      if (!matchesTags) return false;
    }

    return true;
  });
}
