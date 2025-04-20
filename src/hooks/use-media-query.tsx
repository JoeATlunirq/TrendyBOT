import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQueryList = window.matchMedia(query);
      const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
      
      // Set initial state
      setMatches(mediaQueryList.matches);
      
      // Add listener
      mediaQueryList.addEventListener('change', listener);
      
      // Clean up listener
      return () => mediaQueryList.removeEventListener('change', listener);
    } else {
        console.warn("useMediaQuery: window is undefined, defaulting to false.");
        setMatches(false); // Default value for SSR or non-browser environments
    }
  }, [query]);

  return matches;
} 