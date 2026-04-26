export interface SearchResult {
  id: string;
  score: number;
}

export interface SearchProvider {
  add(id: string, content: string): void;
  update(id: string, content: string): void;
  remove(id: string): void;
  search(terms: string[]): SearchResult[];
  clear(): void;
  size(): number;
}

export class SimpleSearchProvider implements SearchProvider {
  private cache = new Map<string, string>();

  add(id: string, content: string): void {
    this.cache.set(id, content.toLowerCase());
  }

  update(id: string, content: string): void {
    this.cache.set(id, content.toLowerCase());
  }

  remove(id: string): void {
    this.cache.delete(id);
  }

  search(terms: string[]): SearchResult[] {
    const normalizedTerms = terms.map((t) => t.toLowerCase());
    const results: SearchResult[] = [];

    for (const [id, content] of this.cache) {
      let score = 0;
      let allMatch = true;

      for (const term of normalizedTerms) {
        if (content.includes(term)) {
          score += content.split(term).length - 1;
        } else {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        results.push({ id, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
