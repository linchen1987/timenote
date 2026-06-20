import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

const NOTEBOOK_PREFIX = 'nb-';
const LIST_LABEL = 'list';

export function getCurrentNotebookToken(): string | null {
  const label = getCurrentWebviewWindow().label;
  const token = label.startsWith(NOTEBOOK_PREFIX) ? label.slice(NOTEBOOK_PREFIX.length) : null;
  return token || null;
}

export function isListWindow(): boolean {
  return getCurrentWebviewWindow().label === LIST_LABEL;
}

export async function openNotebookWindow(token: string, name: string): Promise<void> {
  await invoke('open_notebook_window', { token, name });
}

export async function openListWindow(): Promise<void> {
  await invoke('open_list_window');
}

export async function closeCurrentWindow(): Promise<void> {
  await getCurrentWebviewWindow().close();
}
