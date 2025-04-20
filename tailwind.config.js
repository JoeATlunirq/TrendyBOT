/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Previous Figma Colors (can be removed later if not needed)
        figma_white_bg: 'var(--figma-color-bg-white)',
        figma_black_text: 'var(--figma-color-text-black)',
        figma_black_text_60: 'rgba(var(--figma-color-text-black-rgb), 0.6)',
        figma_white_text: 'var(--figma-color-text-white)',
        figma_white_text_80: 'rgba(var(--figma-color-text-white-rgb), 0.8)',
        figma_white_text_95: 'rgba(var(--figma-color-text-white-rgb), 0.95)',
        figma_white_text_70: 'rgba(var(--figma-color-text-white-rgb), 0.7)',
        figma_white_border: 'rgba(var(--figma-color-border-white-rgb), 0.1)',
        // Trendy.bot Colors (Using hyphens for consistency)
        'trendy-yellow': '#F6D44C',
        'trendy-brown': '#1B130E',
        // Base colors for utility generation
        background: '#1B130E', // trendy-brown
        foreground: '#E5E5E5', // Example: Light neutral gray
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'], // Keep existing if used elsewhere
        montserrat: ['Montserrat', 'sans-serif'], // Keep existing if used elsewhere
        roboto_mono: ['Roboto Mono', 'monospace'], // Keep existing if used elsewhere
        m_plus_1: ['M PLUS 1', 'sans-serif'], // Keep existing if used elsewhere
        orbitron: ['Orbitron', 'sans-serif'], // Add Orbitron
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(180deg, rgba(255, 255, 255, 0.00) 0%, #2E96FF 100%)', // Example, might need update
        'button-gradient': 'linear-gradient(180deg, #4A9EFF 0%, #2A7FFF 100%)', // Example, might need update
        'gradient-radial': 'radial-gradient(circle, var(--tw-gradient-stops))', // Keep if needed
      },
      // Add marquee animation
      animation: {
        marquee: "marquee var(--duration) linear infinite",
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(calc(-100% - var(--gap)))" },
        },
      },
      // ... other extensions
    },
  },
  plugins: [],
} 