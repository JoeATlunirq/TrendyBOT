import { useEffect, useState } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext'; // Import context

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check system preference
    const darkModePreference = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(darkModePreference.matches);

    // Listen for system changes
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    darkModePreference.addEventListener('change', handler);
    return () => darkModePreference.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <div className={`min-h-screen bg-gradient-to-br transition-colors duration-200
        ${isDark 
          ? 'from-trendy-brown-dark via-trendy-brown to-trendy-brown-light text-trendy-yellow'
          : 'from-white via-secondary-50 to-secondary-100 text-trendy-brown'
        }`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
} 