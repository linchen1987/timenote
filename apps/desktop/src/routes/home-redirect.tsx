import { STORAGE_KEYS } from '@timenote/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { getCurrentNotebookToken, isListWindow } from '../lib/notebook-window';

export function HomeRedirect() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const notebookToken = getCurrentNotebookToken();
    if (notebookToken) {
      navigate(`/s/${notebookToken}`, { replace: true });
    } else if (isListWindow()) {
      navigate('/s/list', { replace: true });
    } else {
      const lastNotebook = localStorage.getItem(STORAGE_KEYS.LAST_NOTEBOOK_TOKEN);
      navigate(lastNotebook ? `/s/${lastNotebook}` : '/s/list', { replace: true });
    }
    setLoading(false);
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return null;
}
