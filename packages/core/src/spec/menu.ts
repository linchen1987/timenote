import { z } from 'zod';
import { IsoDateString } from './manifest';

/**
 * # menu.json — Sidebar Menu Tree
 *
 * Path: .timenote/menu.json
 * Core: yes | Syncable: yes
 * Supports: 10000 nodes, 1000 levels, drag-and-drop
 * Storage: nested; runtime: flat via menu-transform.ts
 *
 * @example
 * {
 *   "version": 1,
 *   "updated_at": "2026-04-25T12:00:00Z",
 *   "items": [
 *     { "title": "工作项目", "type": "note", "note_id": "20260425-121000-1110" },
 *     { "title": "近期想法", "type": "search", "search": "xxx" }
 *   ]
 * }
 */

export interface MenuItem {
  title: string;
  type: 'note' | 'search';
  note_id?: string;
  search?: string;
  children?: MenuItem[];
}

const MenuItemSchema: z.ZodType<MenuItem> = z.lazy(() =>
  z.object({
    title: z.string(),
    type: z.enum(['note', 'search']),
    note_id: z.string().optional(),
    search: z.string().optional(),
    children: z.array(MenuItemSchema).optional(),
  }),
);

export const MENU_VERSION = 1 as const;

export const MenuDataSchema = z.object({
  version: z.literal(MENU_VERSION),
  updated_at: IsoDateString,
  items: z.array(MenuItemSchema),
});

export type MenuData = z.infer<typeof MenuDataSchema>;

export function createMenuData(items: MenuItem[], updatedAt?: string): MenuData {
  return {
    version: MENU_VERSION,
    updated_at: updatedAt ?? new Date().toISOString(),
    items,
  };
}

export const MENU_EXAMPLE = {
  version: MENU_VERSION,
  updated_at: '2026-04-25T12:00:00Z',
  items: [
    {
      title: '工作项目',
      type: 'note',
      note_id: '20260425-121000-1110',
      children: [{ title: 'Timenote 架构图', type: 'note', note_id: '20260425-130000-2228' }],
    },
    { title: '近期想法', type: 'search', search: 'xxx' },
  ],
} satisfies MenuData;

export const RuntimeMenuItemSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  order: z.number(),
  title: z.string(),
  type: z.enum(['note', 'search']),
  note_id: z.string().optional(),
  search: z.string().optional(),
});

export type RuntimeMenuItem = z.infer<typeof RuntimeMenuItemSchema>;
