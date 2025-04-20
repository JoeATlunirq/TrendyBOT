import { createContext, useContext } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDark: false, // Consider matching initial state if possible, or manage carefully
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext); 