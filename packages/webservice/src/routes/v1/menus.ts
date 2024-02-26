import type { Request, Response } from '../../types';

export const getMenus = async (req: Request, res: Response) => {
  const { space } = req;
  const menus = await space!.getMenus();

  res.json({ menus });
};

export const createMenu = async (req: Request, res: Response) => {
  const { space } = req;
  const {
    name,
    // icon,
    parentId,
    order,
    type,
    config,
  } = req.body;

  //   - matchrules
  //     - type
  //       matchType optional
  //       keywords
  const {
    postId,
    // matchType,
    matchRules,
  } = config;

  const menu = await space!.createMenu({
    name,
    // icon,
    parentId,
    order,
    type,
    config: {
      postId,
      // matchType,
      matchRules,
    },
  });

  res.json(menu);
};

export const deleteMenu = async (req: Request, res: Response) => {
  const { space } = req;
  const { id } = req.body;

  await space!.deleteMenu(id);

  res.json({});
};

export const moveMenu = async (req: Request, res: Response) => {
  const { space } = req;
  const { id, parentId, order } = req.body;

  await space!.moveMenu(id, parentId, { order });

  res.json({});
};
