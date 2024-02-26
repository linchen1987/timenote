import { useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { Routes, Route } from 'react-router-dom';
import Cookies from 'js-cookie';

import Box from '@mui/material/Box';

import List from './List';
import Post from './Post';
import { useSpace, SpaceProvider } from '../contexts/spaces';
import { useLayout, LayoutProvider } from '../contexts/layout';
import { PREFIX } from '../utils/api';
import SideBar from '../components/SideBar';
import NotFound from '../components/NotFound';
import MainBridge from './MainBridge';

function Root() {
  const { space, initialized } = useSpace();
  const { showDrawer, setShowDrawer, showSidebar, setShowSidebar } = useLayout();

  useEffect(() => {
    if (initialized && space?.id) {
      const playgroundUser = Cookies.get('tn_playground_user');
      const dynamicPath = playgroundUser
        ? `${PREFIX}/api/v1/s/${playgroundUser}/${space.id}`
        : `${PREFIX}/api/v1/s/${space.id}`;
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = `${dynamicPath}/manifest.json`;
      document.head.appendChild(link);

      if (process.env.NODE_ENV !== 'development') {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register(`${PREFIX}/sw.js`, { scope: `${PREFIX}/s` });
        }
      }
    }
  }, [space?.id, initialized]);

  // auto refresh playground cookie
  useEffect(() => {
    const key = 'tn_playground_user';

    setInterval(() => {
      const value = Cookies.get(key);
      if (value) {
        Cookies.set(key, value, { expires: 7 });
      }
    }, 2000);
  }, []);

  return (
    <Main>
      <SideBar
        showDrawer={showDrawer}
        showSidebar={showSidebar}
        onCloseDrawer={() => {
          setShowDrawer(false);
        }}
        onOpenDrawer={() => {
          setShowDrawer(true);
        }}
        onCloseSidebar={() => {
          setShowSidebar(false);
        }}
      />
      <Box className="right">
        <Routes>
          <Route index element={<List />} />
          <Route path="m/:menuId" element={<MainBridge />} />
          <Route path="m/:menuId/p/:pid" element={<Post />} />
          <Route path="p/:pid" element={<Post />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Box>
    </Main>
  );
}

export default function Layout() {
  return (
    <SpaceProvider>
      <LayoutProvider>
        <Root />
      </LayoutProvider>
    </SpaceProvider>
  );
}

const Main = styled(Box)(
  ({ theme }) => `
  height: 100vh;
  display: flex;
  color: ${theme.vars.palette.text.primary};
  > .left {
    background-color: #f5f5f5;
    ${theme.getColorSchemeSelector('dark')} {
      background-color: #424242;
    };
  }
  .right {
    height: 100%;
    overflow-y: auto;
    padding: 20px;
    flex-grow: 1;
    background-color: #f5f5f5;
    ${theme.getColorSchemeSelector('dark')} {
      background-color: #141414;
    };
  }`
);
