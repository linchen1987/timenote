import { createMenuData, type MenuData, type RuntimeMenuItem } from '../spec/menu';
import { metaPath } from '../spec/vault-layout';
import type { VaultService } from '../vault/vault-service';
import { flattenMenuItems, nestifyMenuItems } from './menu-transform';

export interface VaultMenuService {
  loadMenu(projectId: string): Promise<RuntimeMenuItem[]>;
  saveMenu(projectId: string, items: RuntimeMenuItem[]): Promise<void>;
}

export function createVaultMenuService(vaultService: VaultService): VaultMenuService {
  return {
    async loadMenu(projectId: string): Promise<RuntimeMenuItem[]> {
      const transport = await vaultService.getLocalClient(projectId);
      const raw = await transport.read(metaPath('menu'));
      const data = JSON.parse(raw) as MenuData;
      return flattenMenuItems(data.items);
    },

    async saveMenu(projectId: string, items: RuntimeMenuItem[]): Promise<void> {
      const transport = await vaultService.getLocalClient(projectId);
      const nested = nestifyMenuItems(items);
      const menu = createMenuData(nested);
      menu.updated_at = new Date().toISOString();
      await transport.write(metaPath('menu'), JSON.stringify(menu, null, 2));
    },
  };
}
