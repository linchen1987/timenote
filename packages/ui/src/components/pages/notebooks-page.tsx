import { CONTACT_EMAIL } from '@timenote/core';
import {
  CloudDownload,
  FolderOpen,
  Github,
  Globe,
  Loader2,
  Mail,
  Plus,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { NotebooksShell, type NotebooksShellProps, useNotebooksShell } from '../notebooks-shell';
import { PageHeader } from '../page-header';

const REPO_URL = 'https://github.com/linchen1987/timenote';
const AUTHOR_URL = 'https://link1987.site';

export interface NotebooksPageProps extends NotebooksShellProps {
  logoSrc?: string;
}

export function NotebooksPage({ logoSrc, ...shellProps }: NotebooksPageProps) {
  return (
    <NotebooksShell {...shellProps}>
      <NotebooksHomeBody logoSrc={logoSrc} />
    </NotebooksShell>
  );
}

function NotebooksHomeBody({ logoSrc }: { logoSrc?: string }) {
  const { triggerCreate, triggerImport, openCloud, openFolder, isImporting } = useNotebooksShell();

  const copyEmail = () => {
    navigator.clipboard.writeText(CONTACT_EMAIL);
    toast.success('邮箱已复制');
  };

  return (
    <>
      <PageHeader title="Notebooks" />

      <div className="flex flex-col items-center text-center px-6 py-16 gap-12">
        <div className="flex flex-col items-center gap-4">
          {logoSrc && <img src={logoSrc} alt="Time Note" className="w-16 h-16 drop-shadow-sm" />}
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">Time Note</h1>
            <p className="text-muted-foreground max-w-md">
              记录想法，构建你的私人知识云端。从左侧选择一个笔记本，或新建一个开始。
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-3xl">
          <button
            type="button"
            onClick={triggerCreate}
            className="group flex flex-col items-start gap-3 p-6 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center text-primary transition-colors">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold">新建笔记本</p>
              <p className="text-sm text-muted-foreground mt-0.5">创建一个全新的本地笔记本</p>
            </div>
          </button>

          <button
            type="button"
            onClick={triggerImport}
            disabled={isImporting}
            className="group flex flex-col items-start gap-3 p-6 rounded-2xl border border-border hover:bg-accent/50 hover:border-primary/40 transition-all text-left disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-xl bg-muted group-hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors">
              {isImporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="font-bold">导入</p>
              <p className="text-sm text-muted-foreground mt-0.5">从 .zip 备份文件恢复</p>
            </div>
          </button>

          <button
            type="button"
            onClick={openCloud}
            className="group flex flex-col items-start gap-3 p-6 rounded-2xl border border-border hover:bg-accent/50 hover:border-primary/40 transition-all text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-muted group-hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold">从云端打开</p>
              <p className="text-sm text-muted-foreground mt-0.5">扫描或拉取 S3 / WebDAV 笔记本</p>
            </div>
          </button>

          {openFolder && (
            <button
              type="button"
              onClick={openFolder}
              className="group flex flex-col items-start gap-3 p-6 rounded-2xl border border-border hover:bg-accent/50 hover:border-primary/40 transition-all text-left sm:col-span-2 lg:col-span-3"
            >
              <div className="w-11 h-11 rounded-xl bg-muted group-hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold">打开本地文件夹</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  选择一个已有的本地目录作为笔记本
                </p>
              </div>
            </button>
          )}
        </div>

        <div className="flex items-center gap-6 text-muted-foreground">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
            title="GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
          <a
            href={AUTHOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
            title="作者"
          >
            <Globe className="w-5 h-5" />
          </a>
          <button
            type="button"
            onClick={copyEmail}
            className="hover:text-foreground transition-colors"
            title="邮箱"
          >
            <Mail className="w-5 h-5" />
          </button>
        </div>

        <Link
          to="/"
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          © 2026 Time Note
        </Link>
      </div>
    </>
  );
}
