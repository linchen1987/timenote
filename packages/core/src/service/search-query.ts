export interface ParsedSearchQuery {
  tags: string[];
  textTerms: string[];
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const tags: string[] = [];
  const textTerms: string[] = [];
  const parts = query.trim().split(/\s+/).filter(Boolean);

  for (const part of parts) {
    if (part.startsWith('#') && part.length > 1) {
      tags.push(part.slice(1));
    } else if (part !== '#') {
      textTerms.push(part);
    }
  }

  return { tags, textTerms };
}

export function extractTagsFromBody(body: string): string[] {
  const hashtagRegex = /#([\w\u4e00-\u9fa5]+)/g;
  const matches = body.matchAll(hashtagRegex);
  return Array.from(new Set(Array.from(matches).map((m) => m[1])));
}
