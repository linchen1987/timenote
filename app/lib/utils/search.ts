/**
 * 过滤笔记内容，支持以空格分隔的多个关键词（AND 逻辑）
 * 支持 #tag 搜索
 */
export function filterNotes<T extends { content: string; id: string }>(
  notes: T[],
  searchQuery: string,
  noteTagsMap?: Record<string, string[]> // noteId -> tagNames[]
): T[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return notes;

  const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
  const textTerms = searchTerms.filter(term => !term.startsWith('#'));
  const tagTerms = searchTerms.filter(term => term.startsWith('#')).map(t => t.slice(1));
  
  return notes.filter(note => {
    const content = note.content.toLowerCase();
    
    // Check text terms
    const matchesText = textTerms.every(term => content.includes(term));
    if (!matchesText) return false;

    // Check tag terms
    if (tagTerms.length > 0) {
      const noteTags = noteTagsMap?.[note.id] || [];
      const noteTagsLower = noteTags.map(t => t.toLowerCase());
      const matchesTags = tagTerms.every(tag => noteTagsLower.includes(tag));
      if (!matchesTags) return false;
    }

    return true;
  });
}
