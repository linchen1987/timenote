import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
} from 'react-router-dom';

import Layout from './pages/Layout';
import NotFound from './pages/NotFound';
import Playground from './pages/playground';
import { ThemeProvider } from './contexts/theme';

const basename = window.blocklet?.prefix || '/';

const isDev = process.env.NODE_ENV === 'development';

export default function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route>
        <Route path="/" element={<Layout />} />
        <Route path="/s" element={<Layout />} />
        <Route path="/s/:spaceId" element={<Layout />} />
        <Route path="/s/:spaceId/*" element={<Layout />} />
        {isDev && [
          <Route key="test" path="/test" element={<Playground />} />,
          <Route key="test*" path="/test/*" element={<Playground />} />,
        ]}
        <Route path="*" element={<NotFound />} />
      </Route>
    ),
    { basename }
  );

  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
