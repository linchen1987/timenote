import type { States } from '../states';

const init = async (options: { states: States }) => {
  const { states } = options;
  const { Posts, Menus } = states;

  const createPost = async (data: {
    content?: string;
    createdAt?: string;
    updatedAt?: string;
  }) => {
    const { content, createdAt, updatedAt } = data;

    const post = await Posts.createPost({ content, createdAt, updatedAt });

    return post;
  };

  const getPosts = async (
    options: Parameters<typeof Posts.getPosts>[0] & {
      menuId?: string;
      query?: string;
    }
  ): ReturnType<typeof Posts.getPosts> => {
    const { menuId, query, ...config } = options;

    if (menuId) {
      const menu = await states.Menus.getMenu(menuId);
      if (menu) {
        config.matchType = menu.config.matchType;
        config.matchRules = menu.config.matchRules;
      }
    }

    if (query) {
      config.matchType = config.matchType || 'all';
      config.matchRules = config.matchRules || [];
      config.matchRules.push({
        type: 'keywords',
        keywords: query.toLowerCase().split(' '),
      });
    }

    const { list, count } = await Posts.getPosts(config);
    return { list, count };
  };

  const getPost = async ({ id }: { id: string }) => {
    const post = await Posts.getPost(id);
    return post;
  };
  const updatePost = async ({ id, content }: { id: string; content: string }) => {
    const post = await Posts.updatePost({ id, content });
    return post;
  };
  const deletePost = async ({ id }: { id: string }) => {
    const post = await Posts.deletePost(id);
    return post;
  };

  const getMenus = Menus.getMenus.bind(Menus);
  const getMenu = Menus.getMenu.bind(Menus);
  const createMenu = Menus.createMenu.bind(Menus);
  const updateMenu = Menus.updateMenu.bind(Menus);
  const deleteMenu = Menus.deleteMenu.bind(Menus);
  const moveMenu = Menus.moveMenu.bind(Menus);

  return {
    createPost,
    getPosts,
    getPost,
    updatePost,
    deletePost,
    getMenus,
    getMenu,
    createMenu,
    updateMenu,
    deleteMenu,
    moveMenu,
  };
};

export default init;
