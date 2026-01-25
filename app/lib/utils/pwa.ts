export function getNotebookMeta(title: string, notebookToken?: string) {
  const meta: any[] = [{ title: `${title} - TimeNote` }];
  
  if (notebookToken) {
    meta.push({
      tagName: "link",
      rel: "manifest",
      href: `/s/${notebookToken}/manifest.webmanifest`,
    });
  }
  
  return meta;
}
