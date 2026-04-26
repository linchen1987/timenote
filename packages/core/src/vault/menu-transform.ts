import { nanoid } from 'nanoid';
import type { MenuItem, RuntimeMenuItem } from './types';

export function flattenMenuItems(
  items: MenuItem[],
  parentId: string | null = null,
): RuntimeMenuItem[] {
  const result: RuntimeMenuItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const id = nanoid(8);

    result.push({
      id,
      parentId,
      order: i,
      title: item.title,
      type: item.type,
      note_id: item.type === 'note' ? item.note_id : undefined,
      search: item.type === 'search' ? item.search : undefined,
    });

    if (item.children && item.children.length > 0) {
      result.push(...flattenMenuItems(item.children, id));
    }
  }

  return result;
}

export function nestifyMenuItems(flatItems: RuntimeMenuItem[]): MenuItem[] {
  const rootItems = flatItems
    .filter((item) => item.parentId === null)
    .sort((a, b) => a.order - b.order);

  return rootItems.map((item) => buildMenuItem(item, flatItems));
}

function buildMenuItem(item: RuntimeMenuItem, allItems: RuntimeMenuItem[]): MenuItem {
  const children = allItems
    .filter((child) => child.parentId === item.id)
    .sort((a, b) => a.order - b.order);

  const result: MenuItem = {
    title: item.title,
    type: item.type,
  };

  if (item.type === 'note') {
    result.note_id = item.note_id;
  }

  if (item.type === 'search') {
    result.search = item.search;
  }

  if (children.length > 0) {
    result.children = children.map((child) => buildMenuItem(child, allItems));
  }

  return result;
}

export function updateMenuNoteId(items: MenuItem[], mapping: Record<string, string>): MenuItem[] {
  return items.map((item) => {
    const updated: MenuItem = { ...item };

    if (item.type === 'note' && item.note_id && mapping[item.note_id]) {
      updated.note_id = mapping[item.note_id];
    }

    if (item.children) {
      updated.children = updateMenuNoteId(item.children, mapping);
    }

    return updated;
  });
}
