import { flattenMenuItems, nestifyMenuItems } from './menu-transform';
import type { RuntimeMenuItem } from './types';
import type { VaultService } from './vault-service';

export interface VaultMenuService {
  loadMenu(projectId: string): Promise<RuntimeMenuItem[]>;
  saveMenu(projectId: string, items: RuntimeMenuItem[]): Promise<void>;
}

export function createVaultMenuService(vaultService: VaultService): VaultMenuService {
  return {
    async loadMenu(projectId: string): Promise<RuntimeMenuItem[]> {
      const data = await vaultService.readMenu(projectId);
      return flattenMenuItems(data.items);
    },

    async saveMenu(projectId: string, items: RuntimeMenuItem[]): Promise<void> {
      const nested = nestifyMenuItems(items);
      await vaultService.writeMenu(projectId, { version: 1, items: nested });
    },
  };
}
