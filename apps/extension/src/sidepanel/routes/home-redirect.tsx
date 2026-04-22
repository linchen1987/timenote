import { STORAGE_KEYS } from '@timenote/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

export function HomeRedirect() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lastNotebook = localStorage.getItem(STORAGE_KEYS.LAST_NOTEBOOK_TOKEN);
    if (lastNotebook) {
      navigate(`/s/${lastNotebook}`, { replace: true });
    } else {
      navigate('/s/list', { replace: true });
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
