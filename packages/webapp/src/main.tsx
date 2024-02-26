import ReactDOM from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import { Global, css } from '@emotion/react';
import { StyledEngineProvider } from '@mui/material/styles';
import './index.css';
import App from './App.tsx';

const globalStyles = css`
  #root {
  }
`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StyledEngineProvider injectFirst>
    <CssBaseline />
    <Global styles={globalStyles} />
    <App />
  </StyledEngineProvider>
);
