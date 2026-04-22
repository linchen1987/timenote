import { ThemeProvider, Toaster } from '@timenote/ui';
import { HashRouter, Outlet, Route, Routes } from 'react-router';
import { SidepanelLayout } from './layout/sidepanel-layout';
import { NoteDetail } from './routes/note-detail';
import { NotebookView } from './routes/notebook';
import { NotebooksList } from './routes/notebooks';
import { Settings } from './routes/settings';
import { TagsView } from './routes/tags';

export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route element={<SidepanelLayout />}>
            <Route path="/" element={<NotebooksList />} />
            <Route path="/notebook/:notebookId" element={<NotebookView />} />
            <Route path="/notebook/:notebookId/notes/:noteId" element={<NoteDetail />} />
            <Route path="/notebook/:notebookId/tags" element={<TagsView />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
      <Toaster />
    </ThemeProvider>
  );
}
