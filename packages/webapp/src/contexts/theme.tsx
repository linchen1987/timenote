import { useContext, createContext } from 'react';
import {
  experimental_extendTheme as extendTheme,
  Experimental_CssVarsProvider as CssVarsProvider,
  useColorScheme,
} from '@mui/material/styles';
import type {} from '@mui/material/themeCssVarsAugmentation';

export type Mode = 'dark' | 'light' | 'system';
type ContextType = {
  mode?: Mode | undefined;
  setMode?: (mode: Mode | null) => void;
};

const ThemeContext = createContext<ContextType>({});
const { Provider } = ThemeContext;

function Main({ children }: { children: React.ReactNode }) {
  const { mode, setMode } = useColorScheme();

  const value = { mode, setMode };

  return <Provider value={value}>{children}</Provider>;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = extendTheme({
    colorSchemes: {
      light: {
        palette: {
          primary: {
            main: '#FFA726',
            light: '#FFBF61',
            dark: '#EA8B00',
            contrastText: '#FFFFFF',
          },
          text: {},
          divider: '#e7e9e3',
        },
      },
      dark: {
        palette: {
          primary: {
            main: '#B06900',
            light: '#D37E00',
            dark: '#8C5300',
            contrastText: '#FFFFFF',
          },
          text: {
            primary: '#e2e2e2',
          },
        },
      },
    },
    components: {
      // MuiOutlinedInput: {
      //   styleOverrides: {
      //     notchedOutline: ({ theme: props }) => ({
      //       borderColor: props.vars.palette.grey[400],
      //     }),
      //     root: ({ theme: props }) => ({
      //       [`&:hover .${outlinedInputClasses.notchedOutline}`]: {
      //         borderColor: props.vars.palette.grey[400],
      //       },
      //       [`&.Mui-focused .${outlinedInputClasses.notchedOutline}`]: {
      //         borderColor: props.vars.palette.grey[400],
      //       },
      //     }),
      //   },
      // },
    },
  });

  return (
    <CssVarsProvider theme={theme}>
      <Main>{children}</Main>
    </CssVarsProvider>
  );
}

function useTheme(): ContextType {
  return useContext(ThemeContext);
}

export { ThemeProvider };
export { useTheme };

export default { ThemeProvider, useTheme };
