import { useState, useContext, createContext } from 'react';

import useScreenSize from '../utils/useScreenSize';

type ContextType = {
  isSmall: boolean;
  showDrawer: boolean;
  setShowDrawer: (show: boolean) => void;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
};

const LayoutContext = createContext<ContextType>({
  isSmall: false,
  showDrawer: false,
  setShowDrawer: () => {},
  showSidebar: false,
  setShowSidebar: () => {},
});
const { Provider } = LayoutContext;

function LayoutProvider({ children }: { children: React.ReactNode }) {
  const { isSmall } = useScreenSize();
  const [showDrawer, setShowDrawer] = useState<boolean>(!isSmall);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  const value = { isSmall, showDrawer, setShowDrawer, showSidebar, setShowSidebar };

  return <Provider value={value}>{children}</Provider>;
}

function useLayout(): ContextType {
  return useContext(LayoutContext);
}

export { LayoutProvider };
export { useLayout };

export default { LayoutProvider, useLayout };
