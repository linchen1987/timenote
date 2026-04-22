import { ThemeProvider, Toaster } from '@timenote/ui';
import { HashRouter, Route, Routes } from 'react-router';
import { NotebookLayoutWrapper } from './layout/notebook-layout';
import { HomeRedirect } from './routes/home-redirect';
import { NoteDetail } from './routes/note-detail';
import { NotebookTimelinePage } from './routes/notebook-notes';
import { NotebookSettings } from './routes/notebook-settings';
import { NotebooksList } from './routes/notebooks';
import { SettingsPage } from './routes/settings';
import { TagsView } from './routes/tags';

export function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/s/list" element={<NotebooksList />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/s/:notebookToken" element={<NotebookLayoutWrapper />}>
            <Route index element={<NotebookTimelinePage />} />
            <Route path="tags" element={<TagsView />} />
            <Route path="settings" element={<NotebookSettings />} />
            <Route path=":noteId" element={<NoteDetail />} />
          </Route>
        </Routes>
      </HashRouter>
      <Toaster />
    </ThemeProvider>
  );
}
