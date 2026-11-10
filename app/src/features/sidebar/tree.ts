import type { Folder } from "../../shared/ipc/types";

export interface FolderNode {
  folder: Folder;
  depth: number;
  hasChildren: boolean;
}

/** Folders in display order, depth first, skipping collapsed subtrees. The
 * default folder comes first among the top level. */
export function flattenFolders(folders: Folder[], collapsed: string[]): FolderNode[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortIndex - b.sortIndex || a.name.localeCompare(b.name));
  }
  const out: FolderNode[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const folder of byParent.get(parent) ?? []) {
      const hasChildren = byParent.has(folder.id);
      out.push({ folder, depth, hasChildren });
      if (hasChildren && !collapsed.includes(folder.id)) walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Ids of a folder and everything inside it. */
export function subtree(folders: Folder[], id: string): Set<string> {
  const ids = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}
