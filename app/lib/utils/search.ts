/**
 * 过滤笔记内容，支持以空格分隔的多个关键词（AND 逻辑）
 */
export function filterNotes<T extends { content: string }>(notes: T[], searchQuery: string): T[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return notes;

  const searchTerms = query.split(/\s+/).filter(term => term.length > 0);
  
  return notes.filter(note => {
    const content = note.content.toLowerCase();
    return searchTerms.every(term => content.includes(term));
  });
}
