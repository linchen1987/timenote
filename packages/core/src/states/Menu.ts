import ShortUniqueId from 'short-unique-id';
import { MenuItemConfig, MenuItemType } from '@timenote/types';

import type { DB } from '../db';
import { base32Arr } from '../utils/constant';

const uid = new ShortUniqueId({ length: 4, dictionary: base32Arr });
const genId = () => uid.rnd();

const init = (options: { db: DB }) => {
  const { db } = options;
  const { Menu } = db;

  const state = {
    createMenu: async (data: {
      name: string;
      icon?: string;
      order?: number;
      parentId?: string;
      type?: MenuItemType;
      config: MenuItemConfig;
    }) => {
      // TODO validate
      const { name, config, parentId, type, icon, order } = data;

      const menu = await Menu.create({
        id: genId(),
        name,
        icon,
        order,
        parentId,
        type: type || 'list',
        config,
      });

      return menu;
    },

    getMenus: async () => {
      const menus = await Menu.findAll({ order: [['createdAt', 'DESC']] });
      return menus.map((menu: any) => menu.toJSON());
    },

    getMenu: async (id: string) => {
      const menu = await Menu.findOne({ where: { id } });
      return menu;
    },

    updateMenu: async (data: { id: string }) => {
      const { id } = data;
      const menu = await Menu.findOne({ where: { id } });
      if (!menu) {
        throw new Error('menu not found');
      }

      // await menu.update({ text });

      return menu;
    },

    deleteMenu: async (id: string) => {
      const menu = await Menu.findOne({ where: { id } });
      if (!menu) {
        throw new Error('menu not found');
      }

      await menu.destroy();

      return menu;
    },

    moveMenu: async (
      id: string,
      parentId: string,
      { order }: { order?: number } = {}
    ) => {
      const menu = await Menu.findOne({ where: { id } });
      if (!menu) {
        throw new Error('menu not found');
      }

      await menu.update({ parentId, order: order ?? menu.order });

      return menu;
    },
  };

  return state;
};

export type MenuState = Awaited<ReturnType<typeof init>>;

export default init;
