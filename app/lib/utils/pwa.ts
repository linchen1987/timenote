export function getNotebookMeta(title: string, notebookToken?: string) {
  const meta: Record<string, string>[] = [{ title: `${title} - TimeNote` }];

  if (notebookToken) {
    meta.push({
      tagName: 'link',
      rel: 'manifest',
      href: `/s/${notebookToken}/manifest.webmanifest`,
    });
  }

  return meta;
}
