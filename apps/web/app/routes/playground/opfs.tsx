'use client';

import {
  createVaultNoteService,
  createVaultService,
  type Manifest,
  type NoteIndex,
  type ParsedNote,
  type VaultMeta,
  type VaultNoteService,
  type VaultService,
} from '@timenote/core/vault';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@timenote/ui';
import { HardDrive, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

export default function OpfsPlayground() {
  const vaultServiceRef = useRef<VaultService | null>(null);
  const noteServiceRef = useRef<VaultNoteService | null>(null);
  const [vaults, setVaults] = useState<VaultMeta[]>([]);
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [timeline, setTimeline] = useState<NoteIndex[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<ParsedNote | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [showNewVault, setShowNewVault] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);

  const getServices = useCallback(async () => {
    if (!vaultServiceRef.current) {
      vaultServiceRef.current = await createVaultService();
      noteServiceRef.current = createVaultNoteService(vaultServiceRef.current);
    }
    return { vaultService: vaultServiceRef.current, noteService: noteServiceRef.current! };
  }, []);

  const refreshVaults = useCallback(async () => {
    setLoading(true);
    try {
      const { vaultService } = await getServices();
      const list = await vaultService.listVaults();
      setVaults(list);
    } catch (e) {
      toast.error(`List vaults failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [getServices]);

  useEffect(() => {
    refreshVaults();
  }, [refreshVaults]);

  const loadTimeline = useCallback(
    async (projectId: string) => {
      setLoading(true);
      try {
        const { vaultService, noteService } = await getServices();
        const m = await vaultService.readManifest(projectId);
        setManifest(m);

        await noteService.activateVault(projectId);
        const notes = await noteService.listNotes({ limit: 100 });
        setTimeline(notes);
        const tags = await noteService.getAllTags();
        setAllTags(tags);

        setSelectedNoteId(null);
        setSelectedNote(null);
        setNoteContent('');
      } catch (e) {
        toast.error(`Load vault failed: ${(e as Error).message}`);
      } finally {
        setLoading(false);
      }
    },
    [getServices],
  );

  const handleCreateVault = async () => {
    const name = newVaultName.trim();
    if (!name) return;
    setLoading(true);
    try {
      const { vaultService } = await getServices();
      const id = await vaultService.createVault(name);
      toast.success(`Vault created: ${id}`);
      setNewVaultName('');
      setShowNewVault(false);
      await refreshVaults();
      setSelectedVault(id);
      await loadTimeline(id);
    } catch (e) {
      toast.error(`Create failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVault = async (projectId: string) => {
    setLoading(true);
    try {
      const { vaultService, noteService } = await getServices();
      await vaultService.deleteVault(projectId);
      toast.success('Vault deleted');
      setConfirmDelete(null);
      if (selectedVault === projectId) {
        noteService.deactivateVault();
        setSelectedVault(null);
        setManifest(null);
        setTimeline([]);
        setSelectedNoteId(null);
        setSelectedNote(null);
        setAllTags([]);
      }
      await refreshVaults();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVault = async (projectId: string) => {
    setSelectedVault(projectId);
    await loadTimeline(projectId);
  };

  const handleReadNote = async (noteId: string) => {
    if (!selectedVault) return;
    setLoading(true);
    try {
      const { noteService } = await getServices();
      const note = await noteService.getNote(selectedVault, noteId);
      if (note) {
        setSelectedNoteId(noteId);
        setSelectedNote(note);
        setNoteContent(note.body);
      } else {
        toast.error('Note not found');
      }
    } catch (e) {
      toast.error(`Read failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!selectedVault) return;
    setLoading(true);
    try {
      const { noteService } = await getServices();
      const noteId = await noteService.createNote(selectedVault);
      toast.success(`Note created: ${noteId}`);
      const notes = await noteService.listNotes({ limit: 100 });
      setTimeline(notes);
      const tags = await noteService.getAllTags();
      setAllTags(tags);
      await handleReadNote(noteId);
    } catch (e) {
      toast.error(`Create note failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedVault) return;
    setLoading(true);
    try {
      const { noteService } = await getServices();
      await noteService.deleteNote(selectedVault, noteId);
      toast.success('Note deleted');
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
        setSelectedNote(null);
        setNoteContent('');
      }
      const notes = await noteService.listNotes({ limit: 100 });
      setTimeline(notes);
      const tags = await noteService.getAllTags();
      setAllTags(tags);
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedVault || !selectedNoteId) return;
    setLoading(true);
    try {
      const { noteService } = await getServices();
      await noteService.updateNote(selectedVault, selectedNoteId, noteContent);
      toast.success('Note saved');
      const note = await noteService.getNote(selectedVault, selectedNoteId);
      if (note) {
        setSelectedNote(note);
      }
      const notes = await noteService.listNotes({ limit: 100 });
      setTimeline(notes);
      const tags = await noteService.getAllTags();
      setAllTags(tags);
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      if (selectedVault) await loadTimeline(selectedVault);
      return;
    }
    setLoading(true);
    try {
      const { noteService } = await getServices();
      const results = await noteService.searchNotes(searchQuery);
      setTimeline(results);
    } catch (e) {
      toast.error(`Search failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleString();

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center gap-4">
          <Link to="/playground">
            <Button variant="ghost" size="icon">
              ←
            </Button>
          </Link>
          <div className="bg-emerald-600 p-2 rounded-lg text-white">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">OPFS Vault Explorer</h1>
            <p className="text-muted-foreground">
              Phase 2: NoteService + IndexService + SearchProvider
            </p>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Vaults</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowNewVault(true)}
                      disabled={loading}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={refreshVaults} disabled={loading}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {showNewVault && (
                  <div className="flex gap-2 p-3 border-b">
                    <Input
                      placeholder="Vault name"
                      value={newVaultName}
                      onChange={(e) => setNewVaultName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateVault()}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateVault}
                      disabled={loading || !newVaultName.trim()}
                    >
                      OK
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowNewVault(false);
                        setNewVaultName('');
                      }}
                    >
                      X
                    </Button>
                  </div>
                )}
                {vaults.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No vaults found</p>
                ) : (
                  <div className="divide-y">
                    {vaults.map((v) => (
                      <div
                        key={v.projectId}
                        className={`group flex items-center justify-between p-3 text-sm cursor-pointer hover:bg-muted ${
                          selectedVault === v.projectId ? 'bg-muted' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="flex-1 text-left truncate"
                          onClick={() => handleSelectVault(v.projectId)}
                        >
                          <div className="font-medium truncate">{v.name}</div>
                          <div className="text-xs text-muted-foreground">{v.projectId}</div>
                        </button>
                        {confirmDelete === v.projectId ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-6 text-xs"
                              onClick={() => handleDeleteVault(v.projectId)}
                            >
                              Delete
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs"
                              onClick={() => setConfirmDelete(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 h-6 w-6"
                            onClick={() => setConfirmDelete(v.projectId)}
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedVault && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Timeline</CardTitle>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCreateNote}
                      disabled={loading}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    {timeline.length} note{timeline.length !== 1 ? 's' : ''}
                    {allTags.length > 0 &&
                      ` · ${allTags.length} tag${allTags.length !== 1 ? 's' : ''}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 space-y-0">
                  <div className="flex gap-2 p-3 border-b">
                    <Input
                      placeholder="Search (#tag text...)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button size="icon" variant="ghost" onClick={handleSearch} disabled={loading}>
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  {searchQuery && (
                    <div className="px-3 py-1 border-b">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setSearchQuery('');
                          if (selectedVault) loadTimeline(selectedVault);
                        }}
                      >
                        Clear search
                      </button>
                    </div>
                  )}
                  <div className="max-h-[400px] overflow-auto">
                    {timeline.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">No notes yet</p>
                    ) : (
                      <div className="divide-y">
                        {timeline.map((note) => (
                          <div
                            key={note.id}
                            className={`group flex items-center justify-between p-3 text-sm hover:bg-muted cursor-pointer ${
                              selectedNoteId === note.id ? 'bg-muted' : ''
                            }`}
                          >
                            <button
                              type="button"
                              className="flex-1 text-left"
                              onClick={() => handleReadNote(note.id)}
                            >
                              <div className="font-medium truncate">{note.title || note.id}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatTime(note.updated_at)}
                              </div>
                              {note.tags.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {note.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-xs bg-secondary px-1.5 py-0.5 rounded"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 h-6 w-6"
                              onClick={() => handleDeleteNote(note.id)}
                            >
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            {manifest && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Manifest</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                    {JSON.stringify(manifest, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {selectedNote ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {selectedNote.frontmatter.title || selectedNoteId}
                    </CardTitle>
                    <CardDescription>
                      Created: {selectedNote.frontmatter.created_at}
                      {' · '}
                      Updated: {selectedNote.frontmatter.updated_at}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                      {JSON.stringify(selectedNote.frontmatter, null, 2)}
                    </pre>
                  </CardContent>
                </Card>

                <Card className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Body</CardTitle>
                      <Button size="sm" onClick={handleSaveNote} disabled={loading}>
                        Save
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 p-0">
                    <textarea
                      className="w-full h-[300px] resize-none border-0 focus-visible:ring-0 rounded-none p-4 font-mono text-sm bg-transparent outline-none"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                          e.preventDefault();
                          handleSaveNote();
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  {selectedVault ? 'Select a note to view' : 'Select a vault to start'}
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
