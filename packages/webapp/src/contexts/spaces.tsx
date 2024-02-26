import {
  useState,
  useEffect,
  useContext,
  createContext,
  useCallback,
  useMemo,
} from 'react';
import useLocalStorage from 'react-use/lib/useLocalStorage';
import { useParams } from 'react-router-dom';

import type { MenuItemConfig, MenuItemType } from '@timenote/types';
import api, { PREFIX } from '../utils/api';
import NotFound from '../components/NotFound';
import { MenuTreeNode, MenuTree } from '../components/NavTree';

export type Space = {
  id: string;
  name: string;
  createdAt: string;
};

type TreeNode<T = unknown> = T & {
  id: string;
  name: string;
  parentId?: string;
  children?: TreeNode<T>[];
  createdAt: string;
  order?: number;
  config: MenuItemConfig;
};

export type CreateMenuParams = {
  name: string;
  icon?: string;
  order?: number;
  parentId?: string;
  type?: MenuItemType;
  config: MenuItemConfig;
};

export type MoveMenuParams = {
  id: string;
  parentId?: string;
  order?: number;
};

type ContextType = {
  spaces: Space[];
  spaceId?: string;
  space: Space | null | undefined;
  setSpace: (s: Space) => void;
  initialized: boolean;
  getSpaces: () => Promise<void>;
  menu: MenuTree | null | undefined;
  menus?: { id: string; postId?: string; searchText?: string }[];
  createMenu: (params: CreateMenuParams) => Promise<void>;
  deleteMenu: (params: { id: string }) => Promise<void>;
  moveMenu: (params: MoveMenuParams) => Promise<void>;
  menuId?: string;
};

function listToTree(list: TreeNode[]): MenuTree {
  const map: Record<string, MenuTreeNode> = {};

  const tree = new MenuTree();

  for (const item of list) {
    map[item.id] = new MenuTreeNode(
      item.id,
      item.name,
      new Date(item.createdAt),
      undefined,
      item.order
    );
  }

  for (const item of list) {
    if (!item.parentId || !map[item.parentId]) {
      tree.addChild(map[item.id]);
    } else {
      const target = map[item.parentId];
      if (target) {
        target.addChild(map[item.id]);
      }
    }
  }

  return tree;
}

const SpaceContext = createContext<ContextType>({
  spaces: [],
  space: null,
  setSpace: () => {},
  getSpaces: async () => {},
  initialized: false,
  menu: null,
  menus: undefined,
  createMenu: async () => {},
  deleteMenu: async () => {},
  moveMenu: async () => {},
});
const { Provider } = SpaceContext;

type CacheMenu = { id: string; postId?: string; searchText?: string };

function SpaceProvider({ children }: { children: React.ReactNode }) {
  // spaceId will NOT change durning the process life cycle
  const params = useParams<{ spaceId: string; '*': string }>();
  const { spaceId } = params;
  const urlPath = params['*'] || '';
  const menuId = useMemo(() => (/m\/(\w+)/.exec(urlPath) || [])[1], [urlPath]);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [cacheSpace, setCacheSpace] = useLocalStorage<Space | null | undefined>(
    'space',
    null
  );
  const space = spaces.find((s) => s.id === spaceId) || cacheSpace;
  const [notFound, setNotFound] = useState<boolean>(false);
  const [menus, setMenus] = useLocalStorage<CacheMenu[]>(`space:${spaceId || ''}-menus`);
  const [menu, setMenu] = useState<MenuTree>();

  const navigateToSpace = (s: Space) => {
    setCacheSpace(s);
    const url = new URL(window.location.href);
    url.pathname = `${PREFIX}/s/${s.id}`;
    url.searchParams.delete('q');
    window.location.href = url.toString();
  };

  const setSpace = navigateToSpace;

  const getSpaces = () => {
    return api
      .get('/api/v1/spaces')
      .then((res) => {
        const list = res.data || [];
        setSpaces(list);

        if (!list.length) {
          setCacheSpace(null);
          if (spaceId) {
            setNotFound(true);
          }
          return;
        }

        // get space and set cache space
        let _space = cacheSpace;
        const match = list.find((s: Space) => s.id === spaceId);
        if (match) {
          _space = match;
          setCacheSpace(match);
        } else if (!cacheSpace || !list.some((s: Space) => s.id === cacheSpace.id)) {
          _space = list[0];
          setCacheSpace(list[0]);
        }

        // check space
        if (!spaceId) {
          navigateToSpace(_space!);
        } else if (_space?.id !== spaceId) {
          setNotFound(true);
        }
      })
      .catch((err) => {
        console.error(err);
      });
  };

  const getMenus = useCallback((_spaceId: string) => {
    return api
      .get(`/api/v1/s/${_spaceId}/menus`)
      .then((res) => {
        const menus: TreeNode[] = res.data?.menus || [];
        const tree = listToTree(menus);
        setMenu(tree);
        if (menus.length) {
          setMenus(
            menus.map((x) => {
              // try to get search text
              const keywords = (x.config?.matchRules || [])[0]?.keywords;
              const searchText = keywords?.join(' ') || '';
              return {
                id: x.id,
                postId: x.config.postId,
                searchText,
              };
            })
          );
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  const createMenu = useCallback(
    (params: CreateMenuParams) => {
      return api
        .post(`/api/v1/s/${spaceId}/createMenu`, params)
        .then(() => {
          return getMenus(spaceId!);
        })
        .catch((err) => {
          console.error(err);
        });
    },
    [spaceId]
  );

  const deleteMenu = useCallback(
    (params: { id: string }) => {
      return api
        .post(`/api/v1/s/${spaceId}/deleteMenu`, params)
        .then(() => {
          return getMenus(spaceId!);
        })
        .catch((err) => {
          console.error(err);
        });
    },
    [spaceId]
  );

  const moveMenu = useCallback(
    async (params: MoveMenuParams) => {
      return api
        .post(`/api/v1/s/${spaceId}/moveMenu`, params)
        .then(() => {
          return getMenus(spaceId!);
        })
        .catch((err) => {
          console.error(err);
        });
    },
    [spaceId]
  );

  useEffect(() => {
    getSpaces().finally(() => {
      setInitialized(true);
    });
  }, []);

  useEffect(() => {
    if (spaceId) {
      getMenus(spaceId);
    }
  }, [spaceId]);

  if (notFound) {
    return <NotFound title="This notebook does not exist" description="" />;
  }

  const value = {
    initialized,
    spaceId,
    spaces,
    space,
    setSpace,
    getSpaces,
    menu,
    menus, // json array
    menuId,
    createMenu,
    deleteMenu,
    moveMenu,
  };

  return <Provider value={value}>{children}</Provider>;
}

function useSpace(): ContextType {
  return useContext(SpaceContext);
}

export { SpaceProvider };
export { useSpace };

export default { SpaceProvider, useSpace };
