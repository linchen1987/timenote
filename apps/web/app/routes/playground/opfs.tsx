'use client';

import type { FsStat, FsTransport } from '@timenote/core';
import { createOpfsTransport } from '@timenote/core';
import { Button } from '@timenote/ui';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  File,
  Folder,
  FolderOpen,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

function isTextFile(name: string, size: number): boolean {
  if (size > 512 * 1024) return false;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const textExts = new Set([
    'txt',
    'md',
    'markdown',
    'json',
    'yaml',
    'yml',
    'xml',
    'html',
    'css',
    'js',
    'ts',
    'tsx',
    'jsx',
    'toml',
    'ini',
    'cfg',
    'conf',
    'sh',
    'bash',
    'zsh',
    'log',
    'csv',
    'env',
    'gitignore',
    'properties',
    'sql',
  ]);
  return textExts.has(ext);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  lastmod: string;
  expanded: boolean;
  loaded: boolean;
  children: TreeNode[];
}

function sortByTypeThenName(
  a: { type: string; basename: string },
  b: { type: string; basename: string },
): number {
  if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
  return a.basename.localeCompare(b.basename);
}

function statToNode(stat: FsStat): TreeNode {
  return {
    name: stat.basename,
    path: stat.filename,
    type: stat.type,
    size: stat.size,
    lastmod: stat.lastmod,
    expanded: false,
    loaded: false,
    children: [],
  };
}

function cloneTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((n) => ({ ...n, children: cloneTree(n.children) }));
}

function updateNodeInTree(
  nodes: TreeNode[],
  path: string,
  updater: (node: TreeNode) => void,
): TreeNode[] {
  const result = cloneTree(nodes);
  const parts = path.split('/').filter(Boolean);
  let current = result;
  for (let i = 0; i < parts.length; i++) {
    const found = current.find((n) => n.name === parts[i]);
    if (!found) break;
    if (i === parts.length - 1) {
      updater(found);
    } else {
      current = found.children;
    }
  }
  return result;
}

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  const parts = path.split('/').filter(Boolean);
  let current = nodes;
  for (let i = 0; i < parts.length; i++) {
    const found = current.find((n) => n.name === parts[i]);
    if (!found) return null;
    if (i === parts.length - 1) return found;
    current = found.children;
  }
  return null;
}

export default function OpfsPlayground() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FsStat | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const transportRef = useRef<FsTransport | null>(null);

  const getTransport = useCallback(async (): Promise<FsTransport> => {
    if (!transportRef.current) {
      const opfsRoot = await navigator.storage.getDirectory();
      transportRef.current = createOpfsTransport(opfsRoot);
    }
    return transportRef.current;
  }, []);

  const loadChildren = useCallback(
    async (parentPath: string): Promise<TreeNode[]> => {
      const transport = await getTransport();
      const list = await transport.list(parentPath);
      return list.sort(sortByTypeThenName).map(statToNode);
    },
    [getTransport],
  );

  const loadRoot = useCallback(async () => {
    setLoading(true);
    try {
      const children = await loadChildren('');
      setTree(children);
    } catch (e) {
      toast.error(`Failed to list: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [loadChildren]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  const toggleFolder = async (path: string) => {
    const node = findNode(tree, path);
    if (!node || node.type !== 'directory') return;

    if (!node.loaded) {
      try {
        const children = await loadChildren(path);
        setTree((prev) =>
          updateNodeInTree(prev, path, (n) => {
            n.children = children;
            n.loaded = true;
            n.expanded = true;
          }),
        );
      } catch (e) {
        toast.error(`Failed to expand: ${(e as Error).message}`);
      }
    } else {
      setTree((prev) =>
        updateNodeInTree(prev, path, (n) => {
          n.expanded = !n.expanded;
        }),
      );
    }
  };

  const handleFileClick = async (entry: FsStat) => {
    setSelectedPath(entry.filename);
    setSelectedFile(entry);
    setLoading(true);
    try {
      const transport = await getTransport();
      if (isTextFile(entry.basename, entry.size)) {
        const text = await transport.read(entry.filename);
        setFileContent(text);
      } else {
        setFileContent(null);
      }
    } catch (e) {
      toast.error(`Failed to read: ${(e as Error).message}`);
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedFile) return;
    try {
      const transport = await getTransport();
      const buffer = await transport.readBinary(selectedFile.filename);
      const blob = new Blob([buffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.basename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(`Download failed: ${(e as Error).message}`);
    }
  };

  const renderTree = (nodes: TreeNode[], depth: number = 0) => (
    <>
      {nodes.map((node) => (
        <div key={node.path} style={{ paddingLeft: `${depth * 8}px` }}>
          <button
            type="button"
            className={`w-max min-w-full flex items-center gap-1 py-1 pr-3 pl-2 text-sm hover:bg-muted/50 rounded-sm whitespace-nowrap ${
              selectedPath === node.path ? 'bg-muted' : ''
            }`}
            onClick={() => {
              if (node.type === 'directory') {
                toggleFolder(node.path);
              } else {
                handleFileClick({
                  filename: node.path,
                  basename: node.name,
                  type: node.type,
                  size: node.size,
                  lastmod: node.lastmod,
                });
              }
            }}
          >
            {node.type === 'directory' && (
              <ChevronRight
                className={`w-3 h-3 shrink-0 text-muted-foreground transition-transform ${node.expanded ? 'rotate-90' : ''}`}
              />
            )}
            {node.type === 'directory' ? (
              node.expanded ? (
                <FolderOpen className="w-4 h-4 shrink-0 text-blue-500" />
              ) : (
                <Folder className="w-4 h-4 shrink-0 text-blue-500" />
              )
            ) : (
              <File className="w-4 h-4 shrink-0 text-muted-foreground" />
            )}
            <span>{node.name}</span>
            {node.type === 'file' && (
              <span className="text-xs text-muted-foreground tabular-nums ml-2">
                {formatSize(node.size)}
              </span>
            )}
          </button>
          {node.type === 'directory' && node.expanded && renderTree(node.children, depth + 1)}
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-3">
        <Link to="/playground">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="bg-emerald-600 p-2 rounded-lg text-white">
          <HardDrive className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold">OPFS Explorer</h1>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={loadRoot} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </header>

      <div className="flex-1 grid md:grid-cols-[280px_1fr] divide-x">
        <div className="overflow-x-auto overflow-y-auto p-2">{renderTree(tree)}</div>

        <div className="overflow-auto">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30">
                <div className="flex items-center gap-2 text-sm">
                  <File className="w-4 h-4" />
                  <span className="font-medium">{selectedFile.basename}</span>
                  <span className="text-muted-foreground">
                    {formatSize(selectedFile.size)}
                    {selectedFile.lastmod &&
                      ` · ${new Date(selectedFile.lastmod).toLocaleString()}`}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download
                </Button>
              </div>
              {fileContent !== null ? (
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                  {fileContent}
                </pre>
              ) : (
                <div className="p-12 text-center text-muted-foreground text-sm">Binary file</div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a file to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
