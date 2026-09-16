/**
 * In-memory registry of active editing sessions (dirty drafts).
 *
 * The note detail page registers its editing state here; the automation
 * runtime checks it before executing agent writes/deletes on the same note,
 * so an in-progress user draft is never silently overwritten (the agent gets
 * NOTE_HAS_UNSAVED_CHANGES instead). Lives in core so the UI package and the
 * desktop automation bridge share one registry per WebView process.
 */

export interface DraftState {
  projectId: string;
  noteId: string;
  dirty: boolean;
  since: number;
}

const drafts = new Map<string, DraftState>();

function key(projectId: string, noteId: string): string {
  return `${projectId}::${noteId}`;
}

export const draftRegistry = {
  register(projectId: string, noteId: string): void {
    drafts.set(key(projectId, noteId), { projectId, noteId, dirty: false, since: Date.now() });
  },

  setDirty(projectId: string, noteId: string, dirty: boolean): void {
    const entry = drafts.get(key(projectId, noteId));
    if (entry) entry.dirty = dirty;
  },

  unregister(projectId: string, noteId: string): void {
    drafts.delete(key(projectId, noteId));
  },

  hasDirtyDraft(projectId: string, noteId: string): boolean {
    return drafts.get(key(projectId, noteId))?.dirty === true;
  },

  getDirtyNoteIds(projectId: string): string[] {
    const ids: string[] = [];
    for (const draft of drafts.values()) {
      if (draft.projectId === projectId && draft.dirty) ids.push(draft.noteId);
    }
    return ids;
  },

  clear(): void {
    drafts.clear();
  },
};
